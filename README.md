# WP Env Sync

[![npm version](https://badge.fury.io/js/%40masonite%2Fwp-env-sync.svg)](https://www.npmjs.com/package/@masonite/wp-env-sync)

Sync the content of a production WordPress site with its lower environments.

- Syncs database (all `wp_` tables)
- Syncs uploads directory
- No limit to the number of lower environments
- Supports both single installs & multisites

## Requirements

- Node >=8
- SSH access to all environments

## Install

```sh
npm install -g @masonite/wp-env-sync
```

## Usage

Execute sync job:

```sh
wp-env-sync --url=https://mysite.com/projects.json --prod=prd --project=wp_site_a
```

Perform a dry run for the sync job:

```sh
wp-env-sync --url=https://mysite.com/projects.json --prod=prd --project=wp_site_a --dry-run
```

### Endpoint Structure

```json
[
    {
        "name": "WordPress Site A",
        "slug": "wp_site_a",
        "type": "wordpress",
        "env": [
            {
                "name": "prd",
                "url": "site-a.com",
                "ssh": "siteaprd@siteaprd.ssh.wpengine.net",
                "public_path": "/home/wpe-user/sites/siteaprd",
                "private_path": "/home/wpe-user/sites/siteaprd/_wpeprivate"
            },
            {
                "name": "tst",
                "url": "staging.site-a.com",
                "ssh": "siteatst@siteatst.ssh.wpengine.net",
                "public_path": "/home/wpe-user/sites/siteatst",
                "private_path": "/home/wpe-user/sites/siteatst/_wpeprivate",
                "search_replace": [
                    [
                        "my_production_api_key",
                        "my_staging_api_key"
                    ],
                    [
                        "my_production_api_secret",
                        "my_staging_api_secret"
                    ]
                ]
            },
            {
                "name": "dev",
                "url": "siteadev.wpengine.com",
                "ssh": "siteadev@siteadev.ssh.wpengine.net",
                "public_path": "/home/wpe-user/sites/siteadev",
                "private_path": "/home/wpe-user/sites/siteadev/_wpeprivate",
                "search_replace": [
                    [
                        "my_production_api_key",
                        "my_development_api_key"
                    ],
                    [
                        "my_production_api_secret",
                        "my_development_api_secret"
                    ]
                ]
            }
        ]
    },
    {
        "name": "WordPress Site B",
        "slug": "wp_site_b",
        "type": "wordpress-multisite",
        "env": [
            {
                "name": "prd",
                "url": "site-b.com",
                "ssh": "sitebprd@sitebprd.ssh.wpengine.net",
                "public_path": "/home/wpe-user/sites/sitebprd",
                "private_path": "/home/wpe-user/sites/sitebprd/_wpeprivate"
            },
            {
                "name": "tst",
                "url": "staging.site-b.com",
                "ssh": "sitebtst@sitebtst.ssh.wpengine.net",
                "public_path": "/home/wpe-user/sites/sitebtst",
                "private_path": "/home/wpe-user/sites/sitebtst/_wpeprivate",
                "options": [
                    [
                        "blogdescription",
                        "This value was programmatically updated only on staging.site-b.com"
                    ],
                    [
                        "test_option",
                        "This value was programmatically updated on specific sites",
                        [
                            "hello.staging.site-b.com",
                            "world.staging.site-b.com"
                        ]
                    ]
                ],
                "site_options": [
                    [
                        "site_name",
                        "TST Sites"
                    ]
                ]
            },
            {
                "name": "dev",
                "url": "sitebdev.wpengine.com",
                "ssh": "sitebdev@sitebdev.ssh.wpengine.net",
                "public_path": "/home/wpe-user/sites/sitebdev",
                "private_path": "/home/wpe-user/sites/sitebdev/_wpeprivate"
            }
        ]
    }
]
```

## License

MIT © [Masonite](https://www.masonite.com)
