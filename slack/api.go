package slack

import (
	"bytes"
	"encoding/json"
	"errors"
	"fastslack/shared"
	"fmt"
	"io"
	"log"
	"net/url"

	http "github.com/bogdanfinn/fhttp"
)

func (c *Client) UserBoot(teamID string, minChannelUpdated int64) (*shared.UserbootResponse, error) {
	query := url.Values{}
	params := url.Values{}
	params.Set("version_all_channels", "false")
	params.Set("return_all_relevant_mpdms", "true")
	params.Set("omit_extras", "feature_usage_data,plan_info,salesforce_features")
	if minChannelUpdated > 0 {
		params.Set("min_channel_updated", fmt.Sprintf("%d", minChannelUpdated))
	}

	raw, err := c.DoWithQuery(teamID, "client.userBoot", params, query)
	if err != nil {
		return nil, err
	}

	var resp shared.UserbootResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) GetConversationMessages(teamID, channelID, cursor string) (*shared.MessagesResponse, error) {
	params := url.Values{}
	params.Set("channel", channelID)
	params.Set("limit", "28")
	if cursor != "" {
		params.Set("cursor", cursor)
	}

	raw, err := c.Do(teamID, "conversations.history", params)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Ok       bool             `json:"ok"`
		Messages []shared.Message `json:"messages"`
		HasMore  bool             `json:"has_more"`
		Metadata struct {
			NextCursor string `json:"next_cursor"`
		} `json:"response_metadata"`
	}

	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, err
	}

	return &shared.MessagesResponse{
		Messages:   resp.Messages,
		HasMore:    resp.HasMore,
		NextCursor: resp.Metadata.NextCursor,
	}, nil
}

func (c *Client) GetUserProfiles(teamID string, userIDs []string) ([]shared.UserProfile, error) {
	ws, ok := c.Session.Workspaces[teamID]

	var team string
	if c.Session.Workspaces[teamID].EnterpriseID != "" {
		team = c.Session.Workspaces[teamID].EnterpriseID
	} else {
		team = teamID
	}

	if !ok {
		return nil, errors.New("unknown workspace")
	}

	updatedIds := make(map[string]int64)
	for _, id := range userIDs {
		updatedIds[id] = 0
	}

	payloadMap := map[string]any{
		"check_interaction":          true,
		"include_profile_only_users": true,
		"token":                      ws.Token,
		"updated_ids":                updatedIds,
		"_x_app_name":                "client",
		"fp":                         "60",
		"enterprise_token":           ws.Token,
	}

	jsonData, _ := json.Marshal(payloadMap)
	apiURL := "https://edgeapi.slack.com/cache/" + team + "/users/info?_x_app_name=client&fp=60&_x_num_retries=0"

	req, err := http.NewRequest("POST", apiURL, bytes.NewReader(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header = http.Header{
		"content-type": {"application/json"},
		"cookie":       {"d=" + c.Session.DCookie},
		"user-agent":   {userAgent},
		"origin":       {"https://app.slack.com"},
		"accept":       {"*/*"},
	}
	req.Header[http.HeaderOrderKey] = []string{
		"content-type",
		"cookie",
		"user-agent",
		"origin",
		"accept",
	}

	resp, err := c.HTTP.Do(req)

	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		OK      bool                 `json:"ok"`
		Error   string               `json:"error,omitempty"`
		Results []shared.UserProfile `json:"results"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if !result.OK {
		log.Printf(apiURL)
		return nil, errors.New("slack api error: " + result.Error)
	}

	return result.Results, nil
}
