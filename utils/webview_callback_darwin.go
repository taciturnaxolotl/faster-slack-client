//go:build darwin

package utils

import "C"

//export slackURLCallback
func slackURLCallback(url *C.char) {
	if slackURLHandler != nil {
		slackURLHandler(C.GoString(url))
	}
}
