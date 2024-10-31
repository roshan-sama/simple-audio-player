## Simple audio player

Organize the mp3 files you own into playlists

## Deployment

Replace these template strings in playlist.html and sw.js, 
const fqdn = "##fqdn##";
const path = "##path##";

and host them at https://${fqdn}/${path}/playlist.html and https://${fqdn}/${path}/sw.js respectively

Download the entire tailwind css bundle from their cdn and host at https://${fqdn}/${path}/tailwind.css
Download the minified Howler javascript bundle and host at https://${fqdn}/${path}/howler.min.js

Host a file with an array of playlist names at
https://${fqdn}/${path}/playlists.json

For every playlist name in the JSON array in the above file,
host another file that contains a list of song names:
https://${fqdn}/${path}/${playlistName}.json

Then, the player will attempt to fetch songs at
this url:
https://${fqdn}/${path}/${song}.mp3

sw.js will attempt to cache your audio locally when you play it. You should be able to disable this by modifying your browser settings

## Roadmap

1. Service workers to cache songs on client **DONE**
2. Time delay between songs **DONE**
3. Loading indicator to display loading state between when we press play or next and the song begins **DONE**

## Why host your own purchased songs?
- Youtube and other subscription sites can take music down for various reasons
- No ads
- Works in the background on phones, or even with the phone turned off (some apps like Youtube won't let you play videos unless they have focus on your screen)
- Subscription services can change their prices and terms. I noticed base youtube removed the shuffle option from playlists
