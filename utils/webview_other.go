//go:build !darwin

package utils

import "github.com/wailsapp/wails/v3/pkg/application"

func SetWebviewUserAgent(window application.Window, ua string)          {}
func AddUserScript(window application.Window, js string)                {}
func InterceptSlackURL(window application.Window, handler func(string)) {}
