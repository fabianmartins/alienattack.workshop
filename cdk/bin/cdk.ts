#!/usr/bin/env node
import cdk = require('@aws-cdk/core');

import { MainLayer } from '../lib/layer/mainLayer';
import { NRTAProps } from '../lib/nrta';
import { Utils } from '../lib/util/utils'
import { FileSystemCredentials } from 'aws-sdk';

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
let initProps = new NRTAProps();
initProps.setApplicationName(envname);

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