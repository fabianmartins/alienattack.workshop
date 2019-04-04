#!/usr/bin/env node
import cdk = require('@aws-cdk/cdk');

import { MainLayer } from '../lib/layer/mainLayer';
import { NRTAProps } from '../lib/nrta';
import { Utils } from '../lib/util/utils'

const app = new cdk.App();
let envname = app.node.getContext('envname');
if (!envname) envname = "";
else envname=envname.toUpperCase();
console.log('Environment name:',envname);
let initProps = new NRTAProps();
initProps.setApplicationName(envname);

Utils.checkforExistingBuckets(initProps.getBucketNames())
    .then((listOfExistingBuckets) => {
        if (listOfExistingBuckets && listOfExistingBuckets.length > 0)
            console.log("The following buckets are NOT being created because already exists: ", listOfExistingBuckets);
        initProps.addParameter('existingbuckets', listOfExistingBuckets);
        new MainLayer(app, initProps.getApplicationName(), initProps);
        app.run();
})
    .catch((errorList) => {
        console.log(errorList);
});