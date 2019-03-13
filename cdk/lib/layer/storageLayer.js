"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cdk_1 = require("@aws-cdk/cdk");
const resourceawarestack_1 = require("./../resourceawarestack");
const aws_s3_1 = require("@aws-cdk/aws-s3");
const aws_cloudfront_1 = require("@aws-cdk/aws-cloudfront");
const aws_iam_1 = require("@aws-cdk/aws-iam");
/**
 * StorageLayer is a construct that describes the required resources
 * to store the static data. That includes both S3 and SystemsManager.
 */
class StorageLayer extends resourceawarestack_1.ResourceAwareConstruct {
    constructor(parent, name, props) {
        super(parent, name, props);
        this.createBuckets();
    }
    createCfnBucket(props) {
        let bucket;
        if (props.alreadyExists) {
            console.log('>>> IMPORTING BUCKET:', props.bucketName);
            bucket = aws_s3_1.Bucket.import(this, props.bucketName, {
                bucketArn: 'arn:aws:s3:::' + props.bucketName
            });
        }
        else {
            if (props.isWeb) {
                console.log('>>> CREATING WEB BUCKET:', props.bucketName);
                bucket = new aws_s3_1.CfnBucket(this, props.bucketName, {
                    bucketName: props.bucketName,
                    accessControl: "Private",
                    corsConfiguration: {
                        corsRules: [
                            {
                                allowedOrigins: ["*"],
                                allowedHeaders: ["*"],
                                allowedMethods: ["GET", "PUT", "POST", "DELETE"]
                            }
                        ]
                    },
                    websiteConfiguration: {
                        indexDocument: 'index.html',
                        errorDocument: 'error.html'
                    }
                });
            }
            else {
                console.log('>>> CREATING BUCKET:', props.bucketName);
                bucket = new aws_s3_1.CfnBucket(this, props.bucketName, {
                    bucketName: props.bucketName,
                    accessControl: "Private"
                });
            }
            if (props.retain)
                bucket.options.deletionPolicy = cdk_1.DeletionPolicy.Retain;
        }
        return bucket;
    }
    createBuckets() {
        let appBucketName = this.properties.getAppRefName().toLowerCase() + '.app';
        let rawDataBucketName = this.properties.getAppRefName().toLowerCase() + '.raw';
        let appBucket = this.createCfnBucket({
            bucketName: appBucketName,
            isWeb: true,
            alreadyExists: this.properties.getParameter('existingbuckets').includes(appBucketName),
            retain: true
        });
        // let appBucket = this.createCfnBucket(appBucketName,true);
        this.addResource('appBucket', appBucket);
        let cloudFrontAccessIdentity = new aws_cloudfront_1.CfnCloudFrontOriginAccessIdentity(this, this.properties.getAppRefName() + 'CDNAccessId', {
            cloudFrontOriginAccessIdentityConfig: {
                // This is the name of the identity
                comment: this.properties.getAppRefName() + 'CDNAccessId'
            }
        });
        new aws_s3_1.CfnBucketPolicy(this, this.properties.getAppRefName() + "AppBucketPolicy", {
            bucket: appBucket.bucketName,
            policyDocument: new aws_iam_1.PolicyDocument()
                .addStatement(new aws_iam_1.PolicyStatement()
                .allow()
                .addAction('s3:GetObject')
                .addResource(appBucket.bucketArn + '/*')
                .addAwsPrincipal('arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ' + cloudFrontAccessIdentity.cloudFrontOriginAccessIdentityId))
        });
        let rawDataBucket = this.createCfnBucket({
            bucketName: rawDataBucketName,
            alreadyExists: this.properties.getParameter('existingbuckets').includes(rawDataBucketName),
            retain: true
        });
        this.addResource('rawDataBucket', rawDataBucket);
    }
    getRawDataBucketArn() {
        let rawDataBucketName = this.properties.getAppRefName().toLowerCase() + '.raw';
        return 'arn:aws:s3:::' + rawDataBucketName;
        //return this.rawDataBucket.bucketArn;
    }
}
exports.StorageLayer = StorageLayer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZUxheWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3RvcmFnZUxheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsc0NBQXlEO0FBQ3pELGdFQUFzRjtBQUN0Riw0Q0FBOEU7QUFDOUUsNERBQTRFO0FBQzVFLDhDQUFtRTtBQVVuRTs7O0dBR0c7QUFDSCxNQUFhLFlBQWEsU0FBUSwyQ0FBc0I7SUFFcEQsWUFBWSxNQUFpQixFQUFFLElBQVksRUFBRSxLQUEyQjtRQUNwRSxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDekIsQ0FBQztJQUVPLGVBQWUsQ0FBQyxLQUEyQjtRQUUvQyxJQUFJLE1BQTRCLENBQUM7UUFDakMsSUFBSSxLQUFLLENBQUMsYUFBYSxFQUFFO1lBQ3JCLE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLEVBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3RELE1BQU0sR0FBRyxlQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsVUFBVSxFQUFFO2dCQUMzQyxTQUFTLEVBQUcsZUFBZSxHQUFDLEtBQUssQ0FBQyxVQUFVO2FBQy9DLENBQUMsQ0FBQTtTQUNMO2FBQU07WUFDSCxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUU7Z0JBQ2IsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsRUFBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3pELE1BQU0sR0FBRyxJQUFJLGtCQUFTLENBQUMsSUFBSSxFQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUU7b0JBQzFDLFVBQVUsRUFBRyxLQUFLLENBQUMsVUFBVTtvQkFDN0IsYUFBYSxFQUFHLFNBQVM7b0JBQ3pCLGlCQUFpQixFQUFHO3dCQUNqQixTQUFTLEVBQUc7NEJBQ1I7Z0NBQ0UsY0FBYyxFQUFHLENBQUMsR0FBRyxDQUFDO2dD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QUFVLENBQUMsYUFBYSxFQUFFLENBQUMsV0FBVyxFQUFFLEdBQUcsTUFBTSxDQUFDO1FBQy9FLE9BQU8sZUFBZSxHQUFDLGlCQUFpQixDQUFDO1FBQ3pDLHNDQUFzQztJQUMxQyxDQUFDO0NBQ0o7QUEzRkQsb0NBMkZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0LCBEZWxldGlvblBvbGljeSB9IGZyb20gJ0Bhd3MtY2RrL2Nkayc7XG5pbXBvcnQgeyBSZXNvdXJjZUF3YXJlQ29uc3RydWN0LCBJUGFyYW1ldGVyQXdhcmVQcm9wcyB9IGZyb20gJy4vLi4vcmVzb3VyY2Vhd2FyZXN0YWNrJ1xuaW1wb3J0IHsgQ2ZuQnVja2V0LCBJQnVja2V0LCBDZm5CdWNrZXRQb2xpY3ksIEJ1Y2tldCB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1zMyc7XG5pbXBvcnQgeyBDZm5DbG91ZEZyb250T3JpZ2luQWNjZXNzSWRlbnRpdHkgfSBmcm9tICdAYXdzLWNkay9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgeyBQb2xpY3lTdGF0ZW1lbnQsIFBvbGljeURvY3VtZW50IH0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5cblxuaW50ZXJmYWNlIElCdWNrZXRDcmVhdGlvblByb3BzIHtcbiAgICBidWNrZXROYW1lIDogc3RyaW5nLFxuICAgIGlzV2ViPyA6IGJvb2xlYW4sXG4gICAgYWxyZWFkeUV4aXN0czogYm9vbGVhbixcbiAgICByZXRhaW4gOiBib29sZWFuXG59XG5cbi8qKlxuICogU3RvcmFnZUxheWVyIGlzIGEgY29uc3RydWN0IHRoYXQgZGVzY3JpYmVzIHRoZSByZXF1aXJlZCByZXNvdXJjZXNcbiAqIHRvIHN0b3JlIHRoZSBzdGF0aWMgZGF0YS4gVGhhdCBpbmNsdWRlcyBib3RoIFMzIGFuZCBTeXN0ZW1zTWFuYWdlci5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0b3JhZ2VMYXllciBleHRlbmRzIFJlc291cmNlQXdhcmVDb25zdHJ1Y3Qge1xuXG4gICAgY29uc3RydWN0b3IocGFyZW50OiBDb25zdHJ1Y3QsIG5hbWU6IHN0cmluZywgcHJvcHM6IElQYXJhbWV0ZXJBd2FyZVByb3BzKSB7XG4gICAgICAgIHN1cGVyKHBhcmVudCwgbmFtZSwgcHJvcHMpO1xuICAgICAgICB0aGlzLmNyZWF0ZUJ1Y2tldHMoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNyZWF0ZUNmbkJ1Y2tldChwcm9wczogSUJ1Y2tldENyZWF0aW9uUHJvcHMpIDogQ2ZuQnVja2V0IHwgSUJ1Y2tldCB7XG5cbiAgICAgICAgbGV0IGJ1Y2tldCA6IENmbkJ1Y2tldCB8IElCdWNrZXQ7XG4gICAgICAgIGlmIChwcm9wcy5hbHJlYWR5RXhpc3RzKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnPj4+IElNUE9SVElORyBCVUNLRVQ6Jyxwcm9wcy5idWNrZXROYW1lKTtcbiAgICAgICAgICAgIGJ1Y2tldCA9IEJ1Y2tldC5pbXBvcnQodGhpcywgcHJvcHMuYnVja2V0TmFtZSwge1xuICAgICAgICAgICAgICAgIGJ1Y2tldEFybiA6ICdhcm46YXdzOnMzOjo6Jytwcm9wcy5idWNrZXROYW1lXG4gICAgICAgICAgICB9KSAgICAgIFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHByb3BzLmlzV2ViKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJz4+PiBDUkVBVElORyBXRUIgQlVDS0VUOicscHJvcHMuYnVja2V0TmFtZSk7XG4gICAgICAgICAgICAgICAgYnVja2V0ID0gbmV3IENmbkJ1Y2tldCh0aGlzLHByb3BzLmJ1Y2tldE5hbWUsIHtcbiAgICAgICAgICAgICAgICAgICAgYnVja2V0TmFtZSA6IHByb3BzLmJ1Y2tldE5hbWVcbiAgICAgICAgICAgICAgICAgICAsYWNjZXNzQ29udHJvbCA6IFwiUHJpdmF0ZVwiXG4gICAgICAgICAgICAgICAgICAgLGNvcnNDb25maWd1cmF0aW9uIDoge1xuICAgICAgICAgICAgICAgICAgICAgICBjb3JzUnVsZXMgOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGxvd2VkT3JpZ2lucyA6IFtcIipcIl1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsYWxsb3dlZEhlYWRlcnMgOiBbXCIqXCJdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLGFsbG93ZWRNZXRob2RzIDogW1wiR0VUXCIsXCJQVVRcIixcIlBPU1RcIixcIkRFTEVURVwiXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICx3ZWJzaXRlQ29uZmlndXJhdGlvbiA6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4RG9jdW1lbnQgOiAnaW5kZXguaHRtbCdcbiAgICAgICAgICAgICAgICAgICAgICAgLGVycm9yRG9jdW1lbnQgOiAnZXJyb3IuaHRtbCdcbiAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnPj4+IENSRUFUSU5HIEJVQ0tFVDonLHByb3BzLmJ1Y2tldE5hbWUpOyBcbiAgICAgICAgICAgICAgICBidWNrZXQgPSBuZXcgQ2ZuQnVja2V0KHRoaXMscHJvcHMuYnVja2V0TmFtZSwge1xuICAgICAgICAgICAgICAgICAgICAgYnVja2V0TmFtZSA6IHByb3BzLmJ1Y2tldE5hbWVcbiAgICAgICAgICAgICAgICAgICAgLGFjY2Vzc0NvbnRyb2wgOiBcIlByaXZhdGVcIlxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocHJvcHMucmV0YWluKSBidWNrZXQub3B0aW9ucy5kZWxldGlvblBvbGljeSA9IERlbGV0aW9uUG9saWN5LlJldGFpbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnVja2V0O1xuICAgIH1cblxuICAgIGNyZWF0ZUJ1Y2tldHMoKSB7XG4gICAgICAgIGxldCBhcHBCdWNrZXROYW1lID0gdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpICsgJy5hcHAnO1xuICAgICAgICBsZXQgcmF3RGF0YUJ1Y2tldE5hbWUgPSB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpLnRvTG93ZXJDYXNlKCkgKyAnLnJhdyc7XG5cbiAgICAgICAgbGV0IGFwcEJ1Y2tldCA9IHRoaXMuY3JlYXRlQ2ZuQnVja2V0KCB7XG4gICAgICAgICAgICAgYnVja2V0TmFtZSA6IGFwcEJ1Y2tldE5hbWVcbiAgICAgICAgICAgICxpc1dlYiA6IHRydWVcbiAgICAgICAgICAgICxhbHJlYWR5RXhpc3RzIDogdGhpcy5wcm9wZXJ0aWVzLmdldFBhcmFtZXRlcignZXhpc3RpbmdidWNrZXRzJykuaW5jbHVkZXMoYXBwQnVja2V0TmFtZSlcbiAgICAgICAgICAgICxyZXRhaW4gOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgIC8vIGxldCBhcHBCdWNrZXQgPSB0aGlzLmNyZWF0ZUNmbkJ1Y2tldChhcHBCdWNrZXROYW1lLHRydWUpO1xuICAgICAgICB0aGlzLmFkZFJlc291cmNlKCdhcHBCdWNrZXQnLGFwcEJ1Y2tldCk7XG5cbiAgICAgICAgbGV0IGNsb3VkRnJvbnRBY2Nlc3NJZGVudGl0eSA9IG5ldyBDZm5DbG91ZEZyb250T3JpZ2luQWNjZXNzSWRlbnRpdHkodGhpcyx0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpKydDRE5BY2Nlc3NJZCcsIHtcbiAgICAgICAgICAgIGNsb3VkRnJvbnRPcmlnaW5BY2Nlc3NJZGVudGl0eUNvbmZpZyA6IHtcbiAgICAgICAgICAgICAgICAvLyBUaGlzIGlzIHRoZSBuYW1lIG9mIHRoZSBpZGVudGl0eVxuICAgICAgICAgICAgICAgIGNvbW1lbnQgOiB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpKydDRE5BY2Nlc3NJZCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICBuZXcgQ2ZuQnVja2V0UG9saWN5KHRoaXMsdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKStcIkFwcEJ1Y2tldFBvbGljeVwiLCB7XG4gICAgICAgICAgICBidWNrZXQgOiBhcHBCdWNrZXQuYnVja2V0TmFtZVxuICAgICAgICAgICAscG9saWN5RG9jdW1lbnQgOiBuZXcgUG9saWN5RG9jdW1lbnQoKVxuICAgICAgICAgICAgICAgLmFkZFN0YXRlbWVudChcbiAgICAgICAgICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KClcbiAgICAgICAgICAgICAgICAgICAuYWxsb3coKVxuICAgICAgICAgICAgICAgICAgIC5hZGRBY3Rpb24oJ3MzOkdldE9iamVjdCcpXG4gICAgICAgICAgICAgICAgICAgLmFkZFJlc291cmNlKGFwcEJ1Y2tldC5idWNrZXRBcm4rJy8qJylcbiAgICAgICAgICAgICAgICAgIC5hZGRBd3NQcmluY2lwYWwoJ2Fybjphd3M6aWFtOjpjbG91ZGZyb250OnVzZXIvQ2xvdWRGcm9udCBPcmlnaW4gQWNjZXNzIElkZW50aXR5ICcrY2xvdWRGcm9udEFjY2Vzc0lkZW50aXR5LmNsb3VkRnJvbnRPcmlnaW5BY2Nlc3NJZGVudGl0eUlkKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgfSk7XG4gICAgICAgIGxldCByYXdEYXRhQnVja2V0ID0gdGhpcy5jcmVhdGVDZm5CdWNrZXQoe1xuICAgICAgICAgICAgIGJ1Y2tldE5hbWUgOiByYXdEYXRhQnVja2V0TmFtZVxuICAgICAgICAgICAgLGFscmVhZHlFeGlzdHMgOiB0aGlzLnByb3BlcnRpZXMuZ2V0UGFyYW1ldGVyKCdleGlzdGluZ2J1Y2tldHMnKS5pbmNsdWRlcyhyYXdEYXRhQnVja2V0TmFtZSlcbiAgICAgICAgICAgICxyZXRhaW4gOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmFkZFJlc291cmNlKCdyYXdEYXRhQnVja2V0JyxyYXdEYXRhQnVja2V0KTtcbiAgICB9XG5cbiAgICBnZXRSYXdEYXRhQnVja2V0QXJuKCkgOiBzdHJpbmcge1xuICAgICAgICBsZXQgcmF3RGF0YUJ1Y2tldE5hbWUgPSB0aGlzLnByb3BlcnRpZXMuZ2V0QXBwUmVmTmFtZSgpLnRvTG93ZXJDYXNlKCkgKyAnLnJhdyc7XG4gICAgICAgIHJldHVybiAnYXJuOmF3czpzMzo6OicrcmF3RGF0YUJ1Y2tldE5hbWU7XG4gICAgICAgIC8vcmV0dXJuIHRoaXMucmF3RGF0YUJ1Y2tldC5idWNrZXRBcm47XG4gICAgfVxufSJdfQ==