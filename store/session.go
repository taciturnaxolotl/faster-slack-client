package store

import (
	"encoding/json"
	"fastslack/shared"

	"github.com/zalando/go-keyring"
)

const (
	keyringService = "fastslack"
	keyringUser    = "session"
)

func SaveSession(session *shared.SlackSession) error {
	data, err := json.Marshal(session)
	if err != nil {
		return err
	}
	return keyring.Set(keyringService, keyringUser, string(data))
}

func ClearSession() {
	keyring.Delete(keyringService, keyringUser)
}

func LoadSession() (*shared.SlackSession, error) {
	data, err := keyring.Get(keyringService, keyringUser)
	if err != nil {
		if err == keyring.ErrNotFound {
			return nil, nil
		}
		return nil, err
	}

	var session shared.SlackSession
	if err := json.Unmarshal([]byte(data), &session); err != nil {
		return nil, err
	}
	return &session, nil
}
