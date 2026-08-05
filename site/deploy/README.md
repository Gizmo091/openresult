# Deploying openresult.dev

The site is a Node process behind nginx on a single machine. There is no
container, no orchestrator and no database, because there is no state: a posted
document is rendered into the response and forgotten.

## Layout on the server

```
/srv/openresult/
  releases/20260805-204702/   one deployment
    public/                   everything served
    server/index.mjs          the process
  current -> releases/…       what systemd runs
  incoming/                   where an archive lands before it is unpacked
```

The four most recent releases are kept. Rolling back is a symlink move, which is
the property worth having at the hour a deployment usually goes wrong.

## Deploying

```sh
./site/deploy/deploy.sh
```

It builds, runs the whole check suite, ships one archive, swaps the symlink,
restarts the service, and then verifies that the commit it expected is the
commit answering on `/VERSION`. It fails if any page stops returning 200.

```sh
./site/deploy/deploy.sh --rollback
```

## Pieces

| File                 | Installed as                            | What it does                    |
| -------------------- | --------------------------------------- | ------------------------------- |
| `openresult.service` | `/etc/systemd/system/`                  | Runs the server as its own user |
| `nginx.conf`         | `/etc/nginx/sites-available/openresult` | TLS, redirects, rate limits     |
| `nginx-proxy.conf`   | `/etc/nginx/openresult-proxy.conf`      | Shared proxy headers            |
| `nginx-tls.conf`     | `/etc/nginx/openresult-tls.conf`        | Protocols, ciphers, stapling    |
| `build-release.sh`   | —                                       | Assembles what is served        |

nginx serves nothing itself. The application already decides what may be cached
and which security headers each response carries, and two places deciding that
is how they come to disagree.

## Certificates

Let's Encrypt, obtained with `certbot certonly --webroot`, renewed by the
`certbot.timer` unit that ships with Debian's package. A deploy hook at
`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads nginx, without
which a renewed certificate sits on disk while the old one is still being served
— up to ninety days, since nothing else restarts nginx on a machine that is
working properly.

Verify with:

```sh
ssh openresult_ovh 'systemctl list-timers certbot.timer; sudo certbot renew --dry-run'
```

## The one thing that is not in this repository

DNS. `openresult.dev` and `www.openresult.dev` are A records at OVH pointing at
the machine. Moving the site means changing them there first.

## Notes for whoever comes next

- **`MemoryDenyWriteExecute` must stay out of the unit file.** V8 compiles
  JavaScript to machine code at runtime and needs pages that are writable and
  then executable; with that setting node dies on its first tiering-up, about a
  second after the first request. Every other systemd hardening option in the
  unit is there on purpose.
- **The URL fetcher refuses anything off the public internet**, re-checking at
  every redirect. That is not paranoia: a fetch-this-URL endpoint is asked for
  `169.254.169.254` within days of existing.
- **The schema is served at the `$id` documents declare**,
  `https://openresult.dev/schema/openresult-1.0.schema.json`. Tools follow that
  URL. It is not a page and may not be moved for tidiness.
