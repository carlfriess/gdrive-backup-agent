# Google Drive Backup Agent (Amazon S3)

I originally developed this script for [Swissloop](https://swissloop.ch) to make regular backups of our shared Google Drive.

This script uses [**rclone**](http://rclone.org) to copy a **Google Drive** folder (or the entire drive) to an **Amazon S3** bucket. It then checks the backups that were previously made and deletes them if they are older than a set number of days. Throughout the process, the script reports it's status to **Slack**.

Run regularly, this provides a simple solution to keep backups of important data.

## Installation

Clone the repository and run npm install:
 
```
git clone https://github.com/carlfriess/gdrive-backup-agent.git
cd gdrive-backup-agent
npm install

```

Next [install rclone](http://rclone.org/install/), then configure it:

```
rclone config
```

Add two remotes:

- The first called **`gdrive`** and follow the instructions to connect rclone to your Google Drive.
- The second called **`s3`** and again follow the instructions. Be sure to add your AWS Access Key and Secret Access Key.

Next, open the `config.json` and the `AWS-credentials.json` files and adjust all the configurations (see [Configuration](#Configuration)).

You'll also need to [add an incoming webhook](https://my.slack.com/services/new/incoming-webhook/) to your Slack team and copy the webhook URL to `config.json`.

Finally run the script to create your first backup:

```
node app.js
```

Ideally you should schedule the script to run regularly. This can be done with **cron** for example.

## Configuration

The configuration for this script is split into two files:

###AWS-credentials.json

| Field | Example | Description |
| ----- |:-------:| ----------- |
| **`accessKeyId`** | `<AWS_ACCESS_KEY>` | The AWS Access Key for a user with access to the appropriate bucket. |
| **`secretAccessKey`** | `<AWS_SECRET_ACCESS_KEY>` | The AWS Secret Access Key for a user with access to the appropriate bucket. |
| **`region`** | `us-west-1` | The AWS region where the bucket is located. |

###config.json

| Field | Example | Description |
| ----- |:-------:| ----------- |
| **`slack.url`** | `<SLACK_WEBHOOK_URL>` | Slack incoming webhook URL. |
| **`slack.username`** | `Google Drive Backup Agent` | The username to use when posting messages to Slack. |
| **`s3.bucketName`** | `<S3_BUCKET_NAME>` | The Amazon S3 bucket where backups should be uploaded to. |
| **`rclone.config`** | `~/.rclone.conf` | Where rclone's configuration file is located. *(Usually: ~/.rclone.conf)* |
| **`rclone.srcPath`** | `gdrive:<GOOGLE_DRIVE_PATH>` | The source path for the backups. Omit the `<GOOGLE_DRIVE_PATH>` to backup your entire Google Drive. |
| **`rclone.destPath`** | `s3:<S3_BUCKET_NAME>` | The source path for the backups, including the bucket name. |
| **`numDaysKept`** | `7` | The number of days a backup should be kept for before being deleted. |
| **`shutdown`** | `false` | Shutdown the system after the backup process has finished.  |

*All fields are required for the script to work correctly!*
