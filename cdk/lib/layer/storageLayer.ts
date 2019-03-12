import { Construct, DeletionPolicy } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack'
import { CfnBucket, IBucket, CfnBucketPolicy, Bucket } from '@aws-cdk/aws-s3';
import { CfnCloudFrontOriginAccessIdentity } from '@aws-cdk/aws-cloudfront';
import { PolicyStatement, PolicyDocument } from '@aws-cdk/aws-iam';


interface IBucketCreationProps {
    bucketName : string,
    isWeb? : boolean,
    alreadyExists: boolean,
    retain : boolean
}

/**
 * StorageLayer is a construct that describes the required resources
 * to store the static data. That includes both S3 and SystemsManager.
 */
export class StorageLayer extends ResourceAwareConstruct {

    constructor(parent: Construct, name: string, props: IParameterAwareProps) {
        super(parent, name, props);
        this.createBuckets();
    }

    private createCfnBucket(props: IBucketCreationProps) : CfnBucket | IBucket {

        let bucket : CfnBucket | IBucket;
        if (props.alreadyExists) {
            console.log('>>> IMPORTING BUCKET:',props.bucketName);
            bucket = Bucket.import(this, props.bucketName, {
                bucketArn : 'arn:aws:s3:::'+props.bucketName
            })      
        } else {
            if (props.isWeb) {
                console.log('>>> CREATING WEB BUCKET:',props.bucketName);
                bucket = new CfnBucket(this,props.bucketName, {
                    bucketName : props.bucketName
                   ,accessControl : "Private"
                   ,corsConfiguration : {
                       corsRules : [
                           { 
                             allowedOrigins : ["*"]
                            ,allowedHeaders : ["*"]
                            ,allowedMethods : ["GET","PUT","POST","DELETE"]
                           }
                       ]
                   }
                   ,websiteConfiguration : {
                        indexDocument : 'index.html'
                       ,errorDocument : 'error.html'
                   }
               })
            } else {
                console.log('>>> CREATING BUCKET:',props.bucketName); 
                bucket = new CfnBucket(this,props.bucketName, {
                     bucketName : props.bucketName
                    ,accessControl : "Private"
                })
            }
            if (props.retain) bucket.options.deletionPolicy = DeletionPolicy.Retain;
        }
        return bucket;
    }

/*
    private createCfnBucket(bucketName: string, isWeb: boolean, alreadyExists: boolean) : CfnBucket | IBucket {

        let bucket : CfnBucket | IBucket;
        if (alreadyExists) {
            console.log('>>> IMPORTING BUCKET:',bucketName);
            bucket = s3.Bucket.import(this, bucketName, {
                bucketArn : 'arn:aws:s3:::'+bucketName
            })
        } else {
            if (isWeb) {
                console.log('>>> CREATING WEB BUCKET:',bucketName);
                bucket = new CfnBucket(this,bucketName, {
                    bucketName : bucketName
                   ,accessControl : "Private"
                   ,corsConfiguration : {
                       corsRules : [
                           { 
                             allowedOrigins : ["*"]
                            ,allowedHeaders : ["*"]
                            ,allowedMethods : ["GET","PUT","POST","DELETE"]
                           }
                       ]
                   }
                   ,websiteConfiguration : {
                        indexDocument : 'index.html'
                       ,errorDocument : 'error.html'
                   }
                   ,versioningConfiguration : {
                        status : 'Suspended'
                   }
               })
            } else {
                console.log('>>> CREATING BUCKET:',bucketName); 
                bucket = new CfnBucket(this,bucketName, {
                     bucketName : bucketName
                    ,accessControl : "Private"
                    ,versioningConfiguration : {
                         status : 'Suspended'
                    }
                })
            }
        }
        return bucket;
    }

*/



    createBuckets() {
        let appBucketName = this.properties.getAppRefName().toLowerCase() + '.app';
        let rawDataBucketName = this.properties.getAppRefName().toLowerCase() + '.raw';

        let appBucket = this.createCfnBucket( {
             bucketName : appBucketName
            ,isWeb : true
            ,alreadyExists : this.properties.getParameter('existingbuckets').includes(appBucketName)
            ,retain : true
        });
       // let appBucket = this.createCfnBucket(appBucketName,true);
        this.addResource('appBucket',appBucket);

        let cloudFrontAccessIdentity = new CfnCloudFrontOriginAccessIdentity(this,this.properties.getAppRefName()+'CDNAccessId', {
            cloudFrontOriginAccessIdentityConfig : {
                // This is the name of the identity
                comment : this.properties.getAppRefName()+'CDNAccessId'
            }
        })

        new CfnBucketPolicy(this,this.properties.getAppRefName()+"AppBucketPolicy", {
            bucket : appBucket.bucketName
           ,policyDocument : new PolicyDocument()
               .addStatement(
                   new PolicyStatement()
                   .allow()
                   .addAction('s3:GetObject')
                   .addResource(appBucket.bucketArn+'/*')
                  .addAwsPrincipal('arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity '+cloudFrontAccessIdentity.cloudFrontOriginAccessIdentityId)
                )
        });
        let rawDataBucket = this.createCfnBucket({
             bucketName : rawDataBucketName
            ,alreadyExists : this.properties.getParameter('existingbuckets').includes(rawDataBucketName)
            ,retain : true
        });
        this.addResource('rawDataBucket',rawDataBucket);
    }

    getRawDataBucketArn() : string {
        let rawDataBucketName = this.properties.getAppRefName().toLowerCase() + '.raw';
        return 'arn:aws:s3:::'+rawDataBucketName;
        //return this.rawDataBucket.bucketArn;
    }
}