package main

import (
	"crypto/sha256"
	"fastslack/utils"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

func generateSSBParams() string {
	instanceID := uuid.New().String()

	h := sha256.New()
	h.Write([]byte("faster-slack-client-" + instanceID))
	vid := fmt.Sprintf("%x", h.Sum(nil))[:32]

	version := "4.48.102"

	return fmt.Sprintf("ssb_vid=%s&ssb_instance_id=%s&v=%s&from_desktop_app=1", vid, instanceID, version)
}

type SlackAuthService struct {
	loginWindow *application.WebviewWindow
}

func (s *SlackAuthService) SlackAuthSuccess(url string) {
	log.Println("[SlackAuth] Caught Slack URL:", url)
	if s.loginWindow != nil {
		s.loginWindow.Close()
	}
}

func (s *SlackAuthService) StartLogin() {
	app := application.Get()
	loginURL := "https://app.slack.com/ssb/signin?" + generateSSBParams()

	s.loginWindow = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:          "Sign in to Slack",
		URL:            loginURL,
		Width:          800,
		Height:         800,
		BackgroundType: application.BackgroundTypeTransparent,
		Mac: application.MacWindow{
			TitleBar:                application.MacTitleBarHiddenInset,
			Backdrop:                application.MacBackdropTranslucent,
			InvisibleTitleBarHeight: 50,
		},
		BackgroundColour: application.NewRGB(26, 29, 33),
	})

	s.loginWindow.OnWindowEvent(events.Common.WindowShow, func(event *application.WindowEvent) {
		utils.SetWebviewUserAgent(s.loginWindow, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36")
		utils.InterceptSlackURL(s.loginWindow, func(url string) {
			s.SlackAuthSuccess(url)
		})
		utils.AddUserScript(s.loginWindow, `
			const style = document.createElement('style');
			style.textContent = 'body { padding-top: 52px; } ';
			document.head.appendChild(style);
		`)
	})

	s.loginWindow.Show()
}
