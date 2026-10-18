# aortizco-site

The source for [aortizco.webalome.link](https://aortizco.webalome.link): my resume and a project tracker that shows every project with its real status (live, building or planned).

It is one static `index.html` with no build step and no dependencies. Project data lives in a block at the top of the script, so updating a status is a one-line edit.

## Run it

Open `index.html` in a browser.

## Deploy

Hosted on Cloudflare Pages by uploading the folder. `_headers` sets the security headers.

## Notes

- No private addresses, hostnames or credentials are in this repo.
- Contact links are set in `CONFIG.contact` in `index.html`.
