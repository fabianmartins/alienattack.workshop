#!/usr/bin/env node
import cdk = require('@aws-cdk/core');

import { MainLayer } from '../lib/layer/mainLayer';
import { NRTAProps } from '../lib/nrta';
import { Utils } from '../lib/util/utils'


const app = new cdk.App();
let envname = app.node.tryGetContext('envname');
if (!envname) {
    console.log("****************************************************");
    console.log("ERROR: your environment name is undefined.\n");
    console.log("Please run the command like this:");
    console.log("cdk [synth|deploy|destroy] -c envname=<your environment name>");
    console.log("****************************************************");
    process.exit(1);
}
else envname=envname.toUpperCase();
console.log('# Environment name:',envname);
var initProps = new NRTAProps();
initProps.setApplicationName(envname);

let setApplicationProperty = (propName : string, description: string) => {
    let envproperty = app.node.tryGetContext(propName);
    if (envproperty) {
        console.log('# '+description+' is going to be deployed: YES');
        initProps.addParameter(propName,true);
    } else {
        console.log('# '+description+' is going to be deployed: NO');
    };
}

// Getting other possible context names
// FOR THE CDN DEPLOYMENT
setApplicationProperty("deploycdn","Cloudfront");
/*
let deploycdn = app.node.tryGetContext('deploycdn');
if (deploycdn) {
    console.log('# Cloudfront is going to be deployed: YES');
    initProps.addParameter("deploycdn",true);
} else {
    console.log('# Cloudfront is going to be deployed: NO');
};
*/

// FOR SSM PARAMETER
setApplicationProperty("sessionparameter","SSM Parameter Session");
/*
let sessionparameter = app.node.tryGetContext('sessionparameter');
if (sessionparameter) {
    console.log('# SSM Parameter Sessionn will be deployed: YES');
    initProps.addParameter("sessionparameter",true);
} else {
    console.log('# SSM Parameter Sessionn will be deployed: NO');
};
*/

// FOR KINESIS DATA STREAMS INTEGRATION
setApplicationProperty("kinesisintegration","Kinesis Data Streams integration");
/*
let kinesisintegration = app.node.tryGetContext('kinesisintegration');
if (kinesisintegration) {
    console.log('# Kinesis Data Streams integration will be deployed : YES');
    initProps.addParameter("kinesisintegration",true);
} else {
    console.log('# Kinesis Data Streams integration will be deployed : NO');
};
*/

// FOR KINESIS FIREHOSE
setApplicationProperty("firehose","Kinesis Firehose");
/*
let firehose = app.node.tryGetContext('firehose');
if (firehose) {
    console.log('# Kinesis Firehose  will be deployed : YES');
    initProps.addParameter("firehose",true);
} else {
    console.log('# Kinesis Firehose  will be deployed : NO');
};
*/

Utils.checkforExistingBuckets(initProps.getBucketNames())
    .then((listOfExistingBuckets) => {
        if (listOfExistingBuckets && listOfExistingBuckets.length > 0)
            console.log("# The following buckets are NOT being created because already exists: ", listOfExistingBuckets);
        initProps.addParameter('existingbuckets', listOfExistingBuckets);
        new MainLayer(app, initProps.getApplicationName(), initProps);
})
    .catch((errorList) => {
        console.log(errorList);
});