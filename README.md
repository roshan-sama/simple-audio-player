## Simple audio player

Organize the mp3 files you own into playlists

## Deployment

Replace these template strings:
const fqdn = "##fqdn##";
const path = "##path##";

Host a file with an array of playlist names at
https://${fqdn}/${path}/playlists.json

For every playlist name in the JSON array in the above file,
host another file that contains a list of song names:
https://${fqdn}/${path}/${playlistName}.json

Then, the player will attempt to fetch songs at
this url:
https://${fqdn}/${path}/${song}.mp3

## Roadmap

1. Service workers to cache songs on client
2. Time delay between songs
3. Loading indicator to display loading state between when we press play or next and the song begins
