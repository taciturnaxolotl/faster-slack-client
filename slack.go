package main

import (
	"fastslack/shared"
	"fastslack/slack"
	"fastslack/store"
	"fmt"
)

type SlackService struct {
	Client       *slack.Client
	States       map[string]*store.WorkspaceState
	UserProfiles map[string]shared.UserProfile
}

func (s *SlackService) ResolveUsers(teamID string, userIDs []string) ([]shared.UserProfile, error) {
	var missing []string
	var result []shared.UserProfile

	for _, id := range userIDs {
		if profile, ok := s.UserProfiles[id]; ok {
			result = append(result, profile)
		} else {
			missing = append(missing, id)
		}
	}

	if len(missing) > 0 {
		fetched, err := s.Client.GetUserProfiles(teamID, missing)
		if err != nil {
			return nil, err
		}
		for _, p := range fetched {
			s.UserProfiles[p.ID] = p
			result = append(result, p)
		}
	}
	return result, nil
}

func (s *SlackService) Boot() error {
	if s.States == nil {
		s.States = make(map[string]*store.WorkspaceState)
	}

	for teamID := range s.Client.Session.Workspaces {
		authResp, err := s.Client.Do(teamID, "auth.test", nil)
		if err != nil {
			return fmt.Errorf("auth.test failed for %s: %w", teamID, err)
		}
		fmt.Printf("auth.test for %s: %s\n", teamID, string(authResp))

		cached, err := store.LoadWorkspace(teamID)
		if err != nil {
			fmt.Printf("Failed to load cache for %s: %v\n", teamID, err)
		}

		var minChannelUpdated int64
		if cached != nil {
			minChannelUpdated = cached.MinChannelUpdated
		}

		resp, err := s.Client.UserBoot(teamID, minChannelUpdated)
		if err != nil {
			return fmt.Errorf("userBoot failed for %s: %w", teamID, err)
		}

		var state *store.WorkspaceState
		if cached != nil {
			cached.MergeBoot(resp)
			state = cached
		} else {
			state = store.StateFromBoot(resp)
		}

		s.States[teamID] = state

		if err := store.SaveWorkspace(teamID, state); err != nil {
			fmt.Printf("Failed to save cache for %s: %v\n", teamID, err)
		}

		if s.States == nil {
			s.States = make(map[string]*store.WorkspaceState)
		}

		if s.UserProfiles == nil {
			s.UserProfiles = make(map[string]shared.UserProfile)
		}

		fmt.Printf("Booted %s: %d channels, %d IMs\n", teamID, len(state.Channels), len(state.IMs))
	}

	return nil
}

func (s *SlackService) GetChannels(teamID string) []shared.Channel {
	state, ok := s.States[teamID]
	if !ok {
		return nil
	}
	channels := make([]shared.Channel, 0, len(state.Channels))
	for _, ch := range state.Channels {
		channels = append(channels, ch)
	}
	return channels
}

func (s *SlackService) GetMessages(teamID, channelID, cursor string) (*shared.MessagesResponse, error) {
	return s.Client.GetConversationMessages(teamID, channelID, cursor)
}

func (s *SlackService) GetIMs(teamID string) []shared.Im {
	state, ok := s.States[teamID]
	if !ok {
		return nil
	}
	ims := make([]shared.Im, 0, len(state.IMs))
	for _, im := range state.IMs {
		ims = append(ims, im)
	}
	return ims
}

func (s *SlackService) GetUserProfile(teamID, userID, hash string, size int) string {
	return fmt.Sprintf("https://ca.slack-edge.com/%s-%s-%s-%d", teamID, userID, hash, size)
}
