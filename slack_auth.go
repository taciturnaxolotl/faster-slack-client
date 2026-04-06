package main

import (
	"crypto/sha256"
	"errors"
	"fastslack/shared"
	"fastslack/utils"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"

	_ "embed"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed scripts/login_style.js
var loginStyleScript string

type slackAuthResponse struct {
    OK           bool                       `json:"ok"`
    TokenResults map[string]slackTokenResult `json:"token_results"`
}

type slackTokenResult struct {
    OK   bool   `json:"ok"`
    User string `json:"user"`
    Team struct {
        ID   string `json:"id"`
        Name string `json:"name"`
        URL  string `json:"url"`
    } `json:"team"`
}

func RedeemAuthCookies(magicToken string, workspaceId string, cookies []shared.Cookie) (*shared.SlackSession, error) {
	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar: jar,
	}

	endpoint := fmt.Sprintf("https://app.slack.com/api/auth.loginMagicBulk?magic_tokens=z-app-%s-%s&ssb=1", workspaceId, magicToken)
	targetURL, err := url.Parse(endpoint)
	if err != nil {
		return nil, err
	}
	var httpCookies []*http.Cookie
	for _, c := range cookies {
		httpCookies = append(httpCookies, &http.Cookie{
			Name:  c.Name,
			Value: c.Value,
		})
	}

	client.Jar.SetCookies(targetURL, httpCookies)

	req, err := http.NewRequest("POST", endpoint, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6_0) AppleWebKit/537.36 (KHTML, like Gecko) Slack/4.48.102 Chrome/144.0.7559.236 Electron/40.8.2 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var dCookie = ""
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "d" {
			dCookie = cookie.Value
		}
	}
	if !found {
		return nil, errors.New("no d cookie found")
	}

	body, _ := io.ReadAll(resp.Body)
	json := string(body)

	session := shared.SlackSession{
		DCookie:
	}

	return
}

func generateSSBParams() string {
	instanceID := uuid.New().String()

	h := sha256.New()
	h.Write([]byte("faster-slack-client-" + instanceID))
	vid := fmt.Sprintf("%x", h.Sum(nil))[:32]

	version := "4.48.102"

	return fmt.Sprintf("ssb_vid=%s&ssb_instance_id=%s&v=%s&from_desktop_app=1", vid, instanceID, version)
}

type SlackAuthService struct {
	mainWindow  *application.WebviewWindow
	loginWindow *application.WebviewWindow
}

func (s *SlackAuthService) SlackAuthSuccess(appUrl string) {
	utils.GetAllCookies(s.loginWindow, func(cookies []shared.Cookie, err error) {

		// get the magic token from the url
		u, _ := url.Parse(appUrl)
		parts := strings.Split(u.Path, "/")
		magicToken := parts[len(parts)-1]
		workspaceId := u.Host

		_ = magicToken

		println("Cookies:", cookies)
		println("Magic Token:", magicToken)
		println("App URL:", appUrl)

		// get a d cookie
		RedeemAuthCookies(magicToken, workspaceId, cookies)

		s.loginWindow.Close()

		// emit the signal to stop loading
		app := application.Get()
		app.Event.Emit("auth:loading", false)
	})

}

func (s *SlackAuthService) StartLogin() {
	app := application.Get()
	app.Event.Emit("auth:loading", true)
	loginURL := "https://app.slack.com/ssb/signin?" + generateSSBParams()

	mx, my := s.mainWindow.Position()

	s.loginWindow = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:          "Sign in to Slack",
		URL:            loginURL,
		Width:          800,
		Height:         800,
		X:              mx + 50,
		Y:              my + 50,
		BackgroundType: application.BackgroundTypeTransparent,
		Mac: application.MacWindow{
			TitleBar:                application.MacTitleBarHiddenInset,
			Backdrop:                application.MacBackdropTranslucent,
			InvisibleTitleBarHeight: 50,
		},
		BackgroundColour: application.NewRGB(26, 29, 33),
	})

	s.loginWindow.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		app.Event.Emit("auth:loading", false)
	})

	s.loginWindow.OnWindowEvent(events.Common.WindowShow, func(event *application.WindowEvent) {
		utils.SetWebviewUserAgent(s.loginWindow, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36")
		utils.InterceptSlackURL(s.loginWindow, func(url string) {
			s.SlackAuthSuccess(url)
		})
		utils.AddUserScript(s.loginWindow, loginStyleScript)
	})

	s.loginWindow.Show()
}
