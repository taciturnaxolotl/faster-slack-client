  import { createResource, createSignal, For, Show, createEffect, createMemo } from "solid-js";
import { useAuth } from "../AuthContext";
import { GetChannels, GetIMs, ResolveUsers, GetChannelSections, GetChannelSectionsPrefs, SetChannelSectionCollapsed } from "../../bindings/fastslack/slackservice";
import { UserProfile } from "../../bindings/fastslack/shared";
import styles from "./Home.module.css";
import { Logout } from "../../bindings/fastslack/slackauthservice";
import MessageList from "../components/MessageList";

export default function Home() {
  const { workspace } = useAuth();

  const [channels] = createResource(workspace, (teamID) => GetChannels(teamID));
  const [ims] = createResource(workspace, (teamID) => GetIMs(teamID));
  const [sections] = createResource(workspace, (teamID) => GetChannelSections(teamID));
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

  const [collapsedSections, setCollapsedSections] = createSignal<Record<string, boolean>>(
    JSON.parse(localStorage.getItem("collapsed_sections") || "{}")
  );

  const [rawPrefs, setRawPrefs] = createSignal<Record<string, any>>({});

  createEffect(() => {
    const teamID = workspace();
    if (teamID) {
      GetChannelSectionsPrefs(teamID).then((prefsStr) => {
        if (prefsStr) {
          try {
            const prefs = JSON.parse(prefsStr);
            setRawPrefs(prefs);
            const collapsed: Record<string, boolean> = {};
            for (const [id, opts] of Object.entries(prefs)) {
              if ((opts as any).sidebar === "hid") {
                collapsed[id] = true;
              }
            }
            setCollapsedSections(prev => {
              const merged = { ...prev, ...collapsed };
              localStorage.setItem("collapsed_sections", JSON.stringify(merged));
              return merged;
            });
          } catch (e) {
            console.error("Failed to parse channel_sections prefs", e);
          }
        }
      });
    }
  });

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      localStorage.setItem("collapsed_sections", JSON.stringify(next));

      // Sync back to slack
      const teamID = workspace();
      if (teamID) {
         const prefs = { ...rawPrefs() };
         if (!prefs[sectionId]) {
            prefs[sectionId] = { c: "0" };
         }
         
         if (next[sectionId]) {
            prefs[sectionId].sidebar = "hid";
         } else {
            delete prefs[sectionId].sidebar;
            // slack seems to set active sometimes or just omit it, let's omit for simplicity
         }
         setRawPrefs(prefs);
         SetChannelSectionCollapsed(teamID, JSON.stringify(prefs));
      }

      return next;
    });
  };

  const sectionedIds = createMemo(() => {
    const ids = new Set<string>();
    const sect = sections();
    if (sect) {
      sect.forEach(s => {
        s.channel_ids_page?.channel_ids?.forEach(id => ids.add(id));
      });
    }
    return ids;
  });

  const orphanedChannels = createMemo(() => {
    const chs = channels();
    if (!chs || !sections()) return [];
    const ids = sectionedIds();
    return chs.filter(c => !c.is_archived && !c.is_mpim && !ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  });

  const orphanedDMs = createMemo(() => {
    const ids = sectionedIds();
    if (!ims() || !sections()) return [];
    return dmList().filter(d => !ids.has(d.id) && !d.is_bot && d.id !== "USLACKBOT");
  });

  const orphanedApps = createMemo(() => {
    const ids = sectionedIds();
    if (!ims() || !sections()) return [];
    return dmList().filter(d => !ids.has(d.id) && (d.is_bot || d.id === "USLACKBOT"));
  });

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
        <Show when={!sections.loading && sections()} fallback={<div class={styles.loading}>Loading sections...</div>}>
          <For each={sections()?.filter(s => !s.is_hidden)}>
            {(section) => (
              <>
                <div class={styles.sectionHeader} onClick={() => toggleSection(section.channel_section_id)} style={{ cursor: "pointer", "user-select": "none" }}>
                  <span style={{ display: "inline-block", transition: "transform 0.2s", transform: collapsedSections()[section.channel_section_id] ? "rotate(-90deg)" : "rotate(0deg)", "margin-right": "4px" }}>▼</span>
                  {section.name || (section.type === "channels" ? "Channels" : section.type === "direct_messages" ? "Direct Messages" : section.type === "slack_connect" ? "Slack Connect" : section.type === "stars" ? "Starred" : section.type === "agents" ? "Agents" : section.type === "salesforce_records" ? "Salesforce" : section.type === "recent_apps" ? "Recent Apps" : section.type)}
                </div>
                <Show when={!collapsedSections()[section.channel_section_id]}>
                  <For each={section.type === "channels" ? orphanedChannels() : []}>
                    {(ch) => (
                      <div class={styles.item} onClick={() => setSelectedChannel(ch.id)} data-selected={selectedChannel() === ch.id ? "true" : undefined}>
                        <span class={styles.hash}>#</span>
                        <span class={styles.itemName}>{ch.name}</span>
                      </div>
                    )}
                  </For>
                  <For each={section.type === "direct_messages" ? orphanedDMs() : []}>
                    {(dm) => (
                      <div class={styles.item} onClick={() => setSelectedChannel(dm.id)} data-selected={selectedChannel() === dm.id ? "true" : undefined}>
                        <Show when={dm.is_mpdm && dm.mpdm_avatars.length > 0}>
                          <div class={styles.itemAvatarGroup}>
                            <For each={dm.mpdm_avatars.slice(0, 2)}>
                              {(avatarUrl) => <img src={avatarUrl} class={styles.itemAvatarStacked} />}
                            </For>
                          </div>
                        </Show>
                        <Show when={!dm.is_mpdm && dm.avatar}>
                          <img src={dm.avatar!} class={styles.itemAvatar} />
                        </Show>
                        <span class={styles.itemName}>{dm.name}</span>
                      </div>
                    )}
                  </For>
                  <For each={section.type === "recent_apps" ? orphanedApps() : []}>
                    {(dm) => (
                      <div class={styles.item} onClick={() => setSelectedChannel(dm.id)} data-selected={selectedChannel() === dm.id ? "true" : undefined}>
                        <Show when={!dm.is_mpdm && dm.avatar}>
                          <img src={dm.avatar!} class={styles.itemAvatar} />
                        </Show>
                        <span class={styles.itemName}>{dm.name}</span>
                      </div>
                    )}
                  </For>
                  <For each={section.channel_ids_page?.channel_ids || []}>
                    {(id) => {
                      const ch = channels()?.find(c => c.id === id);
                      if (ch) {
                        return (
                          <div class={styles.item} onClick={() => setSelectedChannel(ch.id)} data-selected={selectedChannel() === ch.id ? "true" : undefined}>
                            <span class={styles.hash}>#</span>
                            <span class={styles.itemName}>{ch.name}</span>
                          </div>
                        );
                      }
                      const dm = dmList().find(d => d.id === id);
                      if (dm) {
                        return (
                          <div class={styles.item} onClick={() => setSelectedChannel(dm.id)} data-selected={selectedChannel() === dm.id ? "true" : undefined}>
                            <Show when={dm.is_mpdm && dm.mpdm_avatars.length > 0}>
                              <div class={styles.itemAvatarGroup}>
                                <For each={dm.mpdm_avatars.slice(0, 2)}>
                                  {(avatarUrl) => <img src={avatarUrl} class={styles.itemAvatarStacked} />}
                                </For>
                              </div>
                            </Show>
                            <Show when={!dm.is_mpdm && dm.avatar}>
                              <img src={dm.avatar!} class={styles.itemAvatar} />
                            </Show>
                            <span class={styles.itemName}>{dm.name}</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  </For>
                </Show>
              </>
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
