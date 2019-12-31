import { Construct } from '@aws-cdk/core';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack'
import { CloudFrontWebDistribution, CfnCloudFrontOriginAccessIdentity, OriginAccessIdentity } from '@aws-cdk/aws-cloudfront';
import { Bucket, BucketPolicy} from '@aws-cdk/aws-s3';
import { PolicyStatement, ArnPrincipal } from '@aws-cdk/aws-iam';


export class ContentDeliveryLayer extends ResourceAwareConstruct {

    constructor(parent: Construct, name: string, props: IParameterAwareProps) {
        super(parent, name, props);
        this.createDistribution(props);
    }

    private createDistribution(props: IParameterAwareProps) {

        let s3BucketOrCnfBucket = props.getParameter('appBucket');
        let appBucket = <Bucket> Bucket.fromBucketName(this, props.getApplicationName()+'ImportedBucket', s3BucketOrCnfBucket.bucketName);
        
        let cloudFrontAccessIdentity = new OriginAccessIdentity(this,this.properties.getApplicationName()+'CDNAccessId');
        s3BucketOrCnfBucket.grantRead(cloudFrontAccessIdentity);
            
        
        let distribution = new CloudFrontWebDistribution(this, props.getApplicationName(),{
            originConfigs : [
                {
                    s3OriginSource : {
                        s3BucketSource: appBucket,
                        originAccessIdentity : cloudFrontAccessIdentity
                    },
                    behaviors : [ {isDefaultBehavior: true}]
                }
            ]
        });

        this.addResource("cdndomain",distribution.domainName);
    }
}