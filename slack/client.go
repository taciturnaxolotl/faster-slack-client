package slack

import (
	"encoding/json"
	"errors"
	"fastslack/shared"
	"io"
	"log"
	"mime/multipart"
	"net/url"
	"strconv"
	"strings"
	"time"

	http "github.com/bogdanfinn/fhttp"

	tls_client "github.com/bogdanfinn/tls-client"
	"github.com/bogdanfinn/tls-client/profiles"
)

type Client struct {
	Session *shared.SlackSession
	HTTP    tls_client.HttpClient
}

func NewClient(session *shared.SlackSession) *Client {
	options := []tls_client.HttpClientOption{
		tls_client.WithClientProfile(profiles.Chrome_120),
		tls_client.WithTimeout(30000),
	}

	httpClient, err := tls_client.NewHttpClient(tls_client.NewNoopLogger(), options...)
	if err != nil {
		log.Fatalf("Failed to initialize tls-client: %v", err)
	}

	return &Client{
		Session: session,
		HTTP:    httpClient,
	}
}

func (c *Client) Do(teamID string, method string, params url.Values) (json.RawMessage, error) {
	return c.DoWithQuery(teamID, method, params, nil)
}

func (c *Client) DoWithQuery(teamID string, method string, params url.Values, query url.Values) (json.RawMessage, error) {
	ws, ok := c.Session.Workspaces[teamID]
	if !ok {
		return nil, errors.New("unknown workspace: " + teamID)
	}

	if params == nil {
		params = url.Values{}
	}
	params.Set("token", ws.Token)

	baseURL := strings.TrimRight(ws.TeamURL, "/")
	apiURL := baseURL + "/api/" + method
	if query != nil {
		apiURL += "?" + query.Encode()
	}

	var reqBody strings.Builder
	w := multipart.NewWriter(&reqBody)
	for key, vals := range params {
		for _, val := range vals {
			w.WriteField(key, val)
		}
	}
	w.Close()

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(reqBody.String()))
	if err != nil {
		return nil, err
	}

	req.Header = http.Header{
		"content-type": {w.FormDataContentType()},
		"user-agent":   {userAgent},
		"origin":       {"https://app.slack.com"},
		"cookie":       {"d=" + c.Session.DCookie},
		"accept":       {"*/*"},
	}

	req.Header[http.HeaderOrderKey] = []string{
		"content-type",
		"user-agent",
		"origin",
		"cookie",
		"accept",
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		retryAfter, _ := strconv.Atoi(resp.Header.Get("Retry-After"))
		if retryAfter == 0 {
			retryAfter = 5
		}
		time.Sleep(time.Duration(retryAfter) * time.Second)
		return c.Do(teamID, method, params)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var envelope struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, err
	}

	if !envelope.OK {
		if envelope.Error == "ratelimited" {
			time.Sleep(5 * time.Second)
			return c.Do(teamID, method, params)
		}
		return nil, errors.New("slack api error: " + envelope.Error)
	}

	return body, nil
}
