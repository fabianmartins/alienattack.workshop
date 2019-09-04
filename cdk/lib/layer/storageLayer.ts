import { Construct, RemovalPolicy } from '@aws-cdk/core';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack'
import { IBucket, BucketPolicy, Bucket, BucketProps, HttpMethods } from '@aws-cdk/aws-s3';
import { CfnCloudFrontOriginAccessIdentity } from '@aws-cdk/aws-cloudfront';
import { PolicyStatement, ArnPrincipal } from '@aws-cdk/aws-iam';


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

    /**
     * This function receives the desired bucket configuration
     * and then creates (or imports) the bucket
     */
    private createBucket(props: IBucketCreationProps) : IBucket {
        let bucket : IBucket;
        if (props.alreadyExists) {
            console.log('>>> IMPORTING BUCKET:',props.bucketName);
            bucket = Bucket.fromBucketArn(this, props.bucketName,'arn:aws:s3:::'+props.bucketName);      
        } else {
            console.log('>>> CREATING BUCKET:',props.bucketName);
            var bucketProperties : BucketProps;
            if (props.isWeb) {
                if (props.retain)
                   bucketProperties  = {
                        bucketName : props.bucketName
                       ,cors : [
                           {
                               allowedHeaders : ["*"]
                               ,allowedMethods : [
                                   HttpMethods.GET,
                                   HttpMethods.PUT,
                                   HttpMethods.DELETE,
                                   HttpMethods.POST
                               ] 
                               ,allowedOrigins : ["*"]
                           }
                       ]
                       ,websiteIndexDocument : 'index.html'
                       ,websiteErrorDocument : 'error.html'
                       ,removalPolicy : RemovalPolicy.RETAIN
                    }                    
                else 
                    bucketProperties  = {
                        bucketName : props.bucketName
                        ,cors : [
                            {
                                allowedHeaders : ["*"]
                                ,allowedMethods : [
                                    HttpMethods.GET,
                                    HttpMethods.PUT,
                                    HttpMethods.DELETE,
                                    HttpMethods.POST
                                ] 
                                ,allowedOrigins : ["*"]
                            }
                        ]
                        ,websiteIndexDocument : 'index.html'
                        ,websiteErrorDocument : 'error.html'
                    };
                bucket = new Bucket(this, props.bucketName, bucketProperties );
            } else {
                if (props.retain) 
                    bucketProperties =  {
                         bucketName : props.bucketName
                        ,removalPolicy : RemovalPolicy.RETAIN
                    };
                else 
                bucketProperties =  {
                    bucketName : props.bucketName
                };     
                bucket = new Bucket(this,props.bucketName,bucketProperties);
            }
        }
        return bucket;
    }

    createBuckets() {
        let appBucketName = this.properties.getApplicationName().toLowerCase() + '.app';
        let rawDataBucketName = this.properties.getApplicationName().toLowerCase() + '.raw';

        let appBucket = this.createBucket( {
             bucketName : appBucketName
            ,isWeb : true
            ,alreadyExists : this.properties.getParameter('existingbuckets').includes(appBucketName)
            ,retain : true
        });
        this.addResource('appBucket',appBucket);

        let cloudFrontAccessIdentity = new CfnCloudFrontOriginAccessIdentity(this,this.properties.getApplicationName()+'CDNAccessId', {
            cloudFrontOriginAccessIdentityConfig : {
                // This is the name of the identity
                comment : this.properties.getApplicationName()+'CDNAccessId'
            }
        })

        let bucketPolicy = new BucketPolicy(this, this.properties.getApplicationName()+"AppBucketPolicy", {
            bucket : appBucket
        });
        bucketPolicy.document.addStatements(
            new PolicyStatement({
                resources : [  appBucket.bucketArn+'/*' ],
                actions : [ 's3:GetObject' ],
                principals : [
                    new ArnPrincipal('arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity '+cloudFrontAccessIdentity.cloudFrontOriginAccessIdentityConfig)
                ]
            })
        );

        let rawDataBucket = this.createBucket({
             bucketName : rawDataBucketName
            ,alreadyExists : this.properties.getParameter('existingbuckets').includes(rawDataBucketName)
            ,retain : true
        });
        this.addResource('rawDataBucket',rawDataBucket);
    }

    getRawDataBucketArn() : string {
        let rawDataBucketName = this.properties.getApplicationName().toLowerCase() + '.raw';
        return 'arn:aws:s3:::'+rawDataBucketName;
        //return this.rawDataBucket.bucketArn;
    }
}