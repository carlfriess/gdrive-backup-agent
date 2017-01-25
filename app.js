// Dependencies:
var exec = require('child_process').exec;
var Moment = require('moment');
var MomentRange = require('moment-range');
var moment = MomentRange.extendMoment(Moment);
var slack = require('slack-notifier');
var powerOff = require('power-off');

// Load the AWS SDK
var AWS = require('aws-sdk');

// Load AWS credentials
AWS.config.loadFromPath(__dirname + '/AWS-credentials.json');

// Load config:
var config = require(__dirname + '/config.json');

// Set up shutdown function:
process.on('exit', function(){
    if (config.shutdown) {
        powerOff();
    }
});

// Create an S3 client
var s3 = new AWS.S3();

// Set up slack
slack.configure(config.slack);

// Notify Slack about beginning of process
slack.send(":hourglass_flowing_sand: Starting backup of Google Drive!");

// Determine name for backup:
var backupName = "backup-" + moment().format("DD-MMM-YYYY");

// Execute rclone transfer
exec("rclone --config=\"" + config.rclone.config + "\" copy " + config.rclone.srcPath + " " + config.rclone.destPath + "/" + backupName, function(err, stdout, stderr){

    if (err) {

        console.log(err);

        // Notify Slack about error!
        slack.send(":x: An error occurred! Check the logs for details.");

    }

    // Compose log file
    var log = "***** STDOUT *****\n\n" + stdout;
    log += "\n\n***** STDERR *****\n\n" + stderr;
    if (err) {
        log = "***** ERROR *****\n\n" + JSON.stringify(err, null, 4) + "\n\n" + log;
    }

    // Upload log to Amazon S3
    s3.putObject({
        Bucket: config.s3.bucketName,
        Key: backupName + "/backup-log.txt",
        Body: log
    }, function (perr, pres) {
        if (perr) {
            console.log("Error uploading data: ", perr);
        }
        else {
            console.log("Uploaded logs to Amazon S3.");
        }
    });

    // Stop here because of error!
    if (err) {
        return;
    }
    
    var output = parseRcloneOutput(stderr);

    var report = "✅ *Finished backup!* Transferred *" + output.size + "* in *" + output.duration
        + "* (Average rate: _" + output.avgRate + "_).\n>_Errors: " + output.errors + " - Checks: "
        + output.checks + " - Transferred objects: " + output.numObjects + "_";

    console.log(report);

    // Send report to Slack
    slack.send(report);

    // List 'top level' objects and folders in bucket
    s3.listObjectsV2({
        Bucket: config.s3.bucketName,
        Delimiter: "/",
        Prefix: ""
    }, function(err, data) {

        if (err) {
            console.log(err);
            return;
        }

        // Inspect all top level folders
        data.CommonPrefixes.forEach(function(prefix){

            var backupDate = moment(prefix.Prefix, "backup-DD-MMM-YYYY");

            // Check if folder is actually a backup we created
            if (backupDate.isValid()) {

                var lowerLimit = moment().subtract(config.numDaysKept, 'days');
                var keepRange = moment.range(lowerLimit, moment());

                // Check if backup is old enough to be deleted
                if (!keepRange.contains(backupDate)) {

                    // Delete backup
                    deleteObjectsWithPrefix(config.s3.bucketName, prefix.Prefix, function(err){

                        if (!err) {

                            console.log("Deleted backup from " + backupDate.format("DD-MMM-YYYY"));

                            // Report deletion to Slack
                            slack.send(":wastebasket: The backup from " + backupDate.format("DD-MMM-YYYY") + " was deleted!")

                        }

                    });

                }

            }

        })

    });

});


// Parse the output from an rclone process
function parseRcloneOutput(output) {

    return {
        size: lastMatch(output, /Transferred+: +([0-9]+.[0-9]+ \w\w)/g),
        avgRate: lastMatch(output, /Transferred+: +([0-9]+.[0-9]+ \w\w)\w+ \(([0-9]+.[0-9]+ \w\w)/g) + "/s",
        errors: lastMatch(output, /Errors: +(\d+)\n/g),
        checks: lastMatch(output, /Checks: +(\d+)\n/g),
        numObjects: lastMatch(output, /Transferred: +(\d+)\n/g),
        duration: lastMatch(output, /Elapsed time: +(.+)\n/g),
    };

}
function lastHit(string, regex) {
    var hits = string.match(regex) || [];
    return hits.length ? hits[hits.length - 1] : "";
}
function lastMatch(string, regex) {
    var matches = regex.exec(lastHit(string, regex)) || [];
    return matches.length ? matches[matches.length - 1] : "";
}


// Delete all objects with a specific prefix in a bucket.
function deleteObjectsWithPrefix(bucketName, prefix, callback) {
    
    // List objects with prefix (maximum 1000 objects)
    s3.listObjects({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: 1000
    }, function(err, data) {

        if (err) {
            callback(err);
            return;
        }
        
        if (data.Contents.length == 0) {
            callback();
        }

        var params = {
            Bucket: bucketName,
            Delete: {
                Objects: []
            }
        };

        data.Contents.forEach(function(obj) {
          params.Delete.Objects.push({ Key: obj.Key });
        });

        // Delete the listed Objects
        s3.deleteObjects(params, function(err, deleteData) {

            if (err) {
                callback(err);
                return;
            }

            console.log("Deleted " + deleteData.Deleted.length + " objects.");

            // If there are more Objects start again
            if (data.IsTruncated) {
                deleteObjectsWithPrefix(bucketName, prefix, callback);
            }
            else {
                callback();
            }

        });

    });
}
