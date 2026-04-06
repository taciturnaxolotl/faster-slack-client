package shared

type Cookie struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Domain string `json:"domain"`
	Path   string `json:"path"`
}

type SlackSession struct {
	DCookie  string
	Token    string
	UserID   string
	TeamID   string
	TeamName string
	TeamURL  string
	TeamIcon string
}
