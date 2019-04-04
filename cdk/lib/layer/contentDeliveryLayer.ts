import { Construct } from '@aws-cdk/cdk';
import { ResourceAwareConstruct, IParameterAwareProps } from './../resourceawarestack'
import { CloudFrontWebDistribution } from '@aws-cdk/aws-cloudfront';
import { Bucket } from '@aws-cdk/aws-s3';


export class ContentDeliveryLayer extends ResourceAwareConstruct {

    constructor(parent: Construct, name: string, props: IParameterAwareProps) {
        super(parent, name, props);
        this.createDistribution(props);
    }

    private createDistribution(props: IParameterAwareProps) {

        let s3BucketOrCnfBucket = props.getParameter('appBucket');
        let s3Bucket = <Bucket> Bucket.import(this, props.getApplicationName()+'ImportedBucket', {
            bucketName : s3BucketOrCnfBucket.bucketName
        });

        new CloudFrontWebDistribution(this, props.getApplicationName(), {
            originConfigs: [
                {
                    s3OriginSource: {
                         s3BucketSource: s3Bucket
                    },
                    behaviors : [ {isDefaultBehavior: true}]
                }
            ]
         });


    }
}