import { createResource, createSignal, For, Show, createEffect } from "solid-js";
import { useAuth } from "../AuthContext";
import { GetChannels, GetIMs, ResolveUsers } from "../../bindings/fastslack/slackservice";
import { UserProfile } from "../../bindings/fastslack/shared";
import styles from "./Home.module.css";
import { Logout } from "../../bindings/fastslack/slackauthservice";
import MessageList from "../components/MessageList";

export default function Home() {
  const { workspace } = useAuth();

  const [channels] = createResource(workspace, (teamID) => GetChannels(teamID));
  const [ims] = createResource(workspace, (teamID) => GetIMs(teamID));
  const [selectedChannel, setSelectedChannel] = createSignal<string | null>(
    localStorage.getItem("last_selected_channel") || null,
  );

  const [searchOpen, setSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchIndex, setSearchIndex] = createSignal(0);

  let searchInputRef: HTMLInputElement | undefined;

  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const nextState = !searchOpen();
        setSearchOpen(nextState);
        setSearchQuery("");
        setSearchIndex(0);
        
        if (nextState) {
          // Focus input on next tick to allow modal to render
          setTimeout(() => {
            if (searchInputRef) searchInputRef.focus();
          }, 0);
        }
      } else if (e.key === 'Escape' && searchOpen()) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  createEffect(() => {
    const channel = selectedChannel();
    if (channel) {
      localStorage.setItem("last_selected_channel", channel);
    }
  });

  const [profiles, setProfiles] = createSignal<Record<string, UserProfile>>({});

  const getAvatarUrlByUserId = (userId: string, workspaceID: string) => {
    const profile = profiles()[userId];
    if (!profile) return null;
    const hash = profile.profile.avatar_hash;
    return `https://ca.slack-edge.com/${workspaceID}-${userId}-${hash}-48`;
  };

  createEffect(() => {
    const imList = ims();
    const chanList = channels();
    const teamID = workspace();
    
    if (teamID) {
      const userIDs = new Set<string>();
      if (imList) {
        imList.forEach((im) => userIDs.add(im.user));
      }
      
      if (chanList) {
        // Find users in MPDMs by parsing the name
        chanList.filter(c => !c.is_archived && c.is_mpim).forEach(ch => {
          if (ch.members && ch.members.length > 0) {
             ch.members.forEach(m => userIDs.add(m));
          }
        });
      }
      
      if (userIDs.size > 0) {
        ResolveUsers(teamID, [...userIDs]).then((resolved) => {
          const profileMap: Record<string, UserProfile> = {};
          for (const p of resolved) profileMap[p.id] = p;
          setProfiles((prev) => ({ ...prev, ...profileMap }));
        });
      }
    }
  });

  const sortedChannels = () =>
    (channels() ?? [])
      .filter((c) => !c.is_archived && !c.is_mpim)
      .sort((a, b) => a.name.localeCompare(b.name));

  const sortedIMs = () =>
    (ims() ?? [])
      .filter((im) => !im.is_archived)
      .sort((a, b) => a.user.localeCompare(b.user));

  const handleLogout = () => {
    Logout();
  };

  const getAvatarUrl = (profile: UserProfile | undefined, workspaceID: string) => {
    if (!profile) return null;
    const hash = profile.profile.avatar_hash;
    const userId = profile.id;

    return `https://ca.slack-edge.com/${workspaceID}-${userId}-${hash}-48`;
  };

  const dmList = () => {
    return [
      ...sortedIMs().map(im => {
        const profile = profiles()[im.user];
        return { 
          id: im.id, 
          name: profile?.profile.display_name || profile?.profile.real_name || im.user, 
          updated: im.updated || im.created,
          is_bot: profile?.is_bot || false,
          avatar: getAvatarUrl(profile, workspace()!),
          is_mpdm: false,
          mpdm_avatars: []
        };
      }),
      ...(channels() ?? []).filter(c => !c.is_archived && c.is_mpim).map(ch => {
        // MPDM names look like "mpdm-first.last--user2-1"
        const match = ch.name.match(/^mpdm-(.+?)-\d+$/);
        const innerName = match && match[1] ? match[1] : ch.name;
        const names = innerName.split("--");
        
        const displayNames = names.map(n => n.split(/[\._]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "));
        
        const mpdmAvatars: string[] = [];
        const mpdmNames: string[] = [];
        
        // Use Members array directly if available!
        if (ch.members && ch.members.length > 0) {
            for (const uid of ch.members) {
               // filter out our own ID if possible, but we don't have it directly here.
               const p = profiles()[uid];
               
               const url = getAvatarUrlByUserId(uid, workspace()!);
               if (url && !mpdmAvatars.includes(url) && mpdmAvatars.length < 2) {
                 mpdmAvatars.push(url);
               }
               
               if (p) {
                 const niceName = p.profile.display_name || p.profile.real_name || uid;
                 if (!mpdmNames.includes(niceName)) {
                     mpdmNames.push(niceName);
                 }
               }
            }
        } else {
          // Fallback parsing logic
          for (const rawDmName of names) {
            let found = false;
            // Look for a profile whose display name or real name matches this chunk
            for (const [uid, p] of Object.entries(profiles())) {
              const realName = (p.profile.real_name || "").toLowerCase();
              const displayName = (p.profile.display_name || "").toLowerCase();
              const nameToMatch = rawDmName.replace(".", " ").toLowerCase();
              
              if (realName.includes(nameToMatch) || displayName.includes(nameToMatch) || uid === rawDmName) {
                 found = true;
                 const url = getAvatarUrlByUserId(uid, workspace()!);
                 if (url && !mpdmAvatars.includes(url) && mpdmAvatars.length < 2) {
                   mpdmAvatars.push(url);
                 }
                 
                 const niceName = p.profile.display_name || p.profile.real_name || uid;
                 if (!mpdmNames.includes(niceName)) {
                     mpdmNames.push(niceName);
                 }
                 break; // found this user
              }
            }
            if (!found) {
              // fallback to Title Cased name
              mpdmNames.push(rawDmName.split(/[\._]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "));
            }
          }
        }
        
        return {
          id: ch.id, 
          name: mpdmNames.length > 0 ? mpdmNames.join(", ") : displayNames.join(", "),
          updated: ch.updated,
          is_bot: false,
          avatar: null,
          is_mpdm: true,
          mpdm_avatars: mpdmAvatars
        };
      })
    ].sort((a,b) => b.updated - a.updated);
  };

  const allChannelsAndDMs = () => {
    return [
      ...sortedChannels().map(ch => ({ id: ch.id, name: `#${ch.name}`, isChannel: true, raw: ch as any })),
      ...dmList().map(dm => ({ id: dm.id, name: dm.name, isChannel: false, raw: dm as any }))
    ];
  };

  const filteredSearchResults = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return allChannelsAndDMs().slice(0, 20);
    return allChannelsAndDMs().filter(item => item.name.toLowerCase().includes(query)).slice(0, 20);
  };

  createEffect(() => {
    // Reset index when search results change
    filteredSearchResults();
    setSearchIndex(0);
  });

  const handleSearchKeydown = (e: KeyboardEvent) => {
    const results = filteredSearchResults();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[searchIndex()];
      if (selected) {
        setSelectedChannel(selected.id);
        setSearchOpen(false);
      }
    }
  };

  return (
    <div class={styles.layout}>
      <Show when={searchOpen()}>
        <div class={styles.searchOverlay} onClick={() => setSearchOpen(false)}>
          <div class={styles.searchModal} onClick={(e) => e.stopPropagation()}>
            <input 
              ref={searchInputRef}
              class={styles.searchInput} 
              type="text" 
              placeholder="Jump to..." 
              autofocus 
              spellcheck={false}
              autocorrect="off"
              autocomplete="off"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyDown={handleSearchKeydown}
            />
            <div class={styles.searchResults}>
              <For each={filteredSearchResults()}>
                {(item, index) => (
                  <div 
                    class={styles.searchItem} 
                    data-selected={index() === searchIndex() ? "true" : undefined}
                    onMouseEnter={() => setSearchIndex(index())}
                    onClick={() => {
                      setSelectedChannel(item.id);
                      setSearchOpen(false);
                    }}
                  >
                    <Show when={item.isChannel}>
                      <span class={styles.hash}>#</span>
                      <span class={styles.itemName}>{item.raw.name}</span>
                    </Show>
                    <Show when={!item.isChannel}>
                      <Show when={item.raw.is_mpdm && item.raw.mpdm_avatars.length > 0}>
                        <div class={styles.itemAvatarGroup}>
                          <For each={item.raw.mpdm_avatars.slice(0, 2)}>
                            {(avatarUrl) => <img src={avatarUrl as string} class={styles.itemAvatarStacked} />}
                          </For>
                        </div>
                      </Show>
                      <Show when={!item.raw.is_mpdm && item.raw.avatar}>
                        <img src={item.raw.avatar as string} class={styles.itemAvatar} />
                      </Show>
                      <span class={styles.itemName}>{item.name}</span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
      
      <div class={styles.sidebar}>
        <div class={styles.sectionHeader}>Channels</div>
        <Show
          when={!channels.loading}
          fallback={<div class={styles.loading}>Loading...</div>}
        >
          <For each={sortedChannels()}>
            {(ch) => (
              <div
                class={styles.item}
                onClick={() => setSelectedChannel(ch.id)}
              >
                <span class={styles.hash}>#</span>
                <span class={styles.itemName}>{ch.name}</span>
              </div>
            )}
          </For>
        </Show>

        <div class={styles.sectionHeader}>Direct Messages</div>
        <Show
          when={!ims.loading && !channels.loading}
          fallback={<div class={styles.loading}>Loading...</div>}
        >
          <For each={dmList().filter(d => !d.is_bot)}>
            {(item) => (
              <div class={styles.item} onClick={() => setSelectedChannel(item.id)}>
                <Show when={item.is_mpdm && item.mpdm_avatars.length > 0}>
                  <div class={styles.itemAvatarGroup}>
                    <For each={item.mpdm_avatars.slice(0, 2)}>
                      {(avatarUrl) => <img src={avatarUrl} class={styles.itemAvatarStacked} />}
                    </For>
                  </div>
                </Show>
                <Show when={!item.is_mpdm && item.avatar}>
                  <img src={item.avatar!} class={styles.itemAvatar} />
                </Show>
                <span class={styles.itemName}>{item.name}</span>
              </div>
            )}
          </For>
        </Show>

        <Show when={dmList().some(d => d.is_bot)}>
          <div class={styles.sectionHeader}>Bots</div>
          <For each={dmList().filter(d => d.is_bot)}>
            {(item) => (
              <div class={styles.item} onClick={() => setSelectedChannel(item.id)}>
                <Show when={item.avatar}>
                  <img src={item.avatar!} class={styles.itemAvatar} />
                </Show>
                {item.name}
              </div>
            )}
          </For>
        </Show>

        <div class={styles.spacer} />
        <button class="btn btn--ghost" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <div class={styles.main}>
        <Show
          when={selectedChannel()}
          fallback={<span class={styles.placeholder}>Select a channel</span>}
        >
          <MessageList teamID={workspace()!} channelID={selectedChannel()!} />
        </Show>
      </div>
    </div>
  );
}
