#!/usr/bin/env node
import cdk = require('@aws-cdk/cdk');

import { MainLayer } from '../lib/layer/mainLayer';
import { NRTAProps } from '../lib/nrta';
import { Utils } from '../lib/util/utils'

const app = new cdk.App();
let envname = app.node.getContext('envname');
if (!envname) envname = "";
else envname=envname.toUpperCase();
let providedsuffix = app.node.getContext('suffix');
if (!providedsuffix) providedsuffix="";
else providedsuffix=providedsuffix.toUpperCase();
console.log('>>>> envname:',envname);
console.log('>>>> providedSuffix:',providedsuffix);
let initProps = new NRTAProps();
initProps.setApplicationName(envname);
initProps.setSuffix(providedsuffix);

Utils.checkforExistingBuckets(initProps.getBucketNames())
    .then((listOfExistingBuckets) => {
        if (listOfExistingBuckets && listOfExistingBuckets.length > 0)
            console.log("The following buckets are NOT being created because already exists: ", listOfExistingBuckets);
        initProps.addParameter('existingbuckets', listOfExistingBuckets);
        new MainLayer(app, 'NRTA'+envname+providedsuffix, initProps);
        app.run();
})
    .catch((errorList) => {
        console.log(errorList);
});