//go:build darwin

package utils

import "C"
import (
	"encoding/json"
	"fastslack/shared"
)

//export slackURLCallback
func slackURLCallback(url *C.char) {
	if slackURLHandler != nil {
		slackURLHandler(C.GoString(url))
	}
}

//export cookiesCallback
func cookiesCallback(jsonStr *C.char) {
	if cookiesHandler != nil {
		var cookies []shared.Cookie
		err := json.Unmarshal([]byte(C.GoString(jsonStr)), &cookies)
		cookiesHandler(cookies, err)
	}
}
