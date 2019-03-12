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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZUxheWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3RvcmFnZUxheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsc0NBQXlEO0FBQ3pELGdFQUFzRjtBQUN0Riw0Q0FBOEU7QUFDOUUsNERBQTRFO0FBQzVFLDhDQUFtRTtBQVVuRTs7O0dBR0c7QUFDSCxNQUFhLFlBQWEsU0FBUSwyQ0FBc0I7SUFFcEQsWUFBWSxNQUFpQixFQUFFLElBQVksRUFBRSxLQUEyQjtRQUNwRSxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDekIsQ0FBQztJQUVPLGVBQWUsQ0FBQyxLQUEyQjtRQUUvQyxJQUFJLE1BQTRCLENBQUM7UUFDakMsSUFBSSxLQUFLLENBQUMsYUFBYSxFQUFFO1lBQ3JCLE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLEVBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3RELE1BQU0sR0FBRyxlQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsVUFBVSxFQUFFO2dCQUMzQyxTQUFTLEVBQUcsZUFBZSxHQUFDLEtBQUssQ0FBQyxVQUFVO2FBQy9DLENBQUMsQ0FBQTtTQUNMO2FBQU07WUFDSCxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUU7Z0JBQ2IsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsRUFBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3pELE1BQU0sR0FBRyxJQUFJLGtCQUFTLENBQUMsSUFBSSxFQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUU7b0JBQzFDLFVBQVUsRUFBRyxLQUFLLENBQUMsVUFBVTtvQkFDN0IsYUFBYSxFQUFHLFNBQVM7b0JBQ3pCLGlCQUFpQixFQUFHO3dCQUNqQixTQUFTLEVBQUc7NEJBQ1I7Z0NBQ0UsY0FBYyxFQUFHLENBQUMsR0FBRyxDQUFDO2dDQUN0QixjQUFjLEVBQUcsQ0FBQyxHQUFHLENBQUM7Z0NBQ3RCLGNBQWMsRUFBRyxDQUFDLEtBQUssRUFBQyxLQUFLLEVBQUMsTUFBTSxFQUFDLFFBQVEsQ0FBQzs2QkFDL0M7eUJBQ0o7cUJBQ0o7b0JBQ0Esb0JBQW9CLEVBQUc7d0JBQ25CLGFBQWEsRUFBRyxZQUFZO3dCQUM1QixhQUFhLEVBQUcsWUFBWTtxQkFDaEM7aUJBQ0osQ0FBQyxDQUFBO2FBQ0o7aUJBQU07Z0JBQ0gsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsRUFBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3JELE1BQU0sR0FBRyxJQUFJLGtCQUFTLENBQUMsSUFBSSxFQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUU7b0JBQ3pDLFVBQVUsRUFBRyxLQUFLLENBQUMsVUFBVTtvQkFDN0IsYUFBYSxFQUFHLFNBQVM7aUJBQzdCLENBQUMsQ0FBQTthQUNMO1lBQ0QsSUFBSSxLQUFLLENBQUMsTUFBTTtnQkFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLGNBQWMsR0FBRyxvQkFBYyxDQUFDLE1BQU0sQ0FBQztTQUMzRTtRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2xCLENBQUM7SUFFTDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztNQThDRTtJQUlFLGFBQWE7UUFDVCxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLGFBQWEsRUFBRSxDQUFDLFdBQVcsRUFBRSxHQUFHLE1BQU0sQ0FBQztRQUMzRSxJQUFJLGlCQUFpQixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUFFLENBQUMsV0FBVyxFQUFFLEdBQUcsTUFBTSxDQUFDO1FBRS9FLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUU7WUFDakMsVUFBVSxFQUFHLGFBQWE7WUFDMUIsS0FBSyxFQUFHLElBQUk7WUFDWixhQUFhLEVBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDO1lBQ3ZGLE1BQU0sRUFBRyxJQUFJO1NBQ2pCLENBQUMsQ0FBQztRQUNKLDREQUE0RDtRQUMzRCxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBQyxTQUFTLENBQUMsQ0FBQztRQUV4QyxJQUFJLHdCQUF3QixHQUFHLElBQUksa0RBQWlDLENBQUMsSUFBSSxFQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUFFLEdBQUMsYUFBYSxFQUFFO1lBQ3JILG9DQUFvQyxFQUFHO2dCQUNuQyxtQ0FBbUM7Z0JBQ25DLE9BQU8sRUFBRyxJQUFJLENBQUMsVUFBVSxDQUFDLGFBQWEsRUFBRSxHQUFDLGFBQWE7YUFDMUQ7U0FDSixDQUFDLENBQUE7UUFFRixJQUFJLHdCQUFlLENBQUMsSUFBSSxFQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUFFLEdBQUMsaUJBQWlCLEVBQUU7WUFDeEUsTUFBTSxFQUFHLFNBQVMsQ0FBQyxVQUFVO1lBQzdCLGNBQWMsRUFBRyxJQUFJLHdCQUFjLEVBQUU7aUJBQ2pDLFlBQVksQ0FDVCxJQUFJLHlCQUFlLEVBQUU7aUJBQ3BCLEtBQUssRUFBRTtpQkFDUCxTQUFTLENBQUMsY0FBYyxDQUFDO2lCQUN6QixXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBQyxJQUFJLENBQUM7aUJBQ3RDLGVBQWUsQ0FBQyxpRUFBaUUsR0FBQyx3QkFBd0IsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUM5STtTQUNSLENBQUMsQ0FBQztRQUNILElBQUksYUFBYSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUM7WUFDcEMsVUFBVSxFQUFHLGlCQUFpQjtZQUM5QixhQUFhLEVBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUM7WUFDM0YsTUFBTSxFQUFHLElBQUk7U0FDakIsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLFdBQVcsQ0FBQyxlQUFlLEVBQUMsYUFBYSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELG1CQUFtQjtRQUNmLElBQUksaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxXQUFXLEVBQUUsR0FBRyxNQUFNLENBQUM7UUFDL0UsT0FBTyxlQUFlLEdBQUMsaUJBQWlCLENBQUM7UUFDekMsc0NBQXNDO0lBQzFDLENBQUM7Q0FDSjtBQTdJRCxvQ0E2SUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb25zdHJ1Y3QsIERlbGV0aW9uUG9saWN5IH0gZnJvbSAnQGF3cy1jZGsvY2RrJztcbmltcG9ydCB7IFJlc291cmNlQXdhcmVDb25zdHJ1Y3QsIElQYXJhbWV0ZXJBd2FyZVByb3BzIH0gZnJvbSAnLi8uLi9yZXNvdXJjZWF3YXJlc3RhY2snXG5pbXBvcnQgeyBDZm5CdWNrZXQsIElCdWNrZXQsIENmbkJ1Y2tldFBvbGljeSwgQnVja2V0IH0gZnJvbSAnQGF3cy1jZGsvYXdzLXMzJztcbmltcG9ydCB7IENmbkNsb3VkRnJvbnRPcmlnaW5BY2Nlc3NJZGVudGl0eSB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCB7IFBvbGljeVN0YXRlbWVudCwgUG9saWN5RG9jdW1lbnQgfSBmcm9tICdAYXdzLWNkay9hd3MtaWFtJztcblxuXG5pbnRlcmZhY2UgSUJ1Y2tldENyZWF0aW9uUHJvcHMge1xuICAgIGJ1Y2tldE5hbWUgOiBzdHJpbmcsXG4gICAgaXNXZWI/IDogYm9vbGVhbixcbiAgICBhbHJlYWR5RXhpc3RzOiBib29sZWFuLFxuICAgIHJldGFpbiA6IGJvb2xlYW5cbn1cblxuLyoqXG4gKiBTdG9yYWdlTGF5ZXIgaXMgYSBjb25zdHJ1Y3QgdGhhdCBkZXNjcmliZXMgdGhlIHJlcXVpcmVkIHJlc291cmNlc1xuICogdG8gc3RvcmUgdGhlIHN0YXRpYyBkYXRhLiBUaGF0IGluY2x1ZGVzIGJvdGggUzMgYW5kIFN5c3RlbXNNYW5hZ2VyLlxuICovXG5leHBvcnQgY2xhc3MgU3RvcmFnZUxheWVyIGV4dGVuZHMgUmVzb3VyY2VBd2FyZUNvbnN0cnVjdCB7XG5cbiAgICBjb25zdHJ1Y3RvcihwYXJlbnQ6IENvbnN0cnVjdCwgbmFtZTogc3RyaW5nLCBwcm9wczogSVBhcmFtZXRlckF3YXJlUHJvcHMpIHtcbiAgICAgICAgc3VwZXIocGFyZW50LCBuYW1lLCBwcm9wcyk7XG4gICAgICAgIHRoaXMuY3JlYXRlQnVja2V0cygpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlQ2ZuQnVja2V0KHByb3BzOiBJQnVja2V0Q3JlYXRpb25Qcm9wcykgOiBDZm5CdWNrZXQgfCBJQnVja2V0IHtcblxuICAgICAgICBsZXQgYnVja2V0IDogQ2ZuQnVja2V0IHwgSUJ1Y2tldDtcbiAgICAgICAgaWYgKHByb3BzLmFscmVhZHlFeGlzdHMpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCc+Pj4gSU1QT1JUSU5HIEJVQ0tFVDonLHByb3BzLmJ1Y2tldE5hbWUpO1xuICAgICAgICAgICAgYnVja2V0ID0gQnVja2V0LmltcG9ydCh0aGlzLCBwcm9wcy5idWNrZXROYW1lLCB7XG4gICAgICAgICAgICAgICAgYnVja2V0QXJuIDogJ2Fybjphd3M6czM6OjonK3Byb3BzLmJ1Y2tldE5hbWVcbiAgICAgICAgICAgIH0pICAgICAgXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAocHJvcHMuaXNXZWIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnPj4+IENSRUFUSU5HIFdFQiBCVUNLRVQ6Jyxwcm9wcy5idWNrZXROYW1lKTtcbiAgICAgICAgICAgICAgICBidWNrZXQgPSBuZXcgQ2ZuQnVja2V0KHRoaXMscHJvcHMuYnVja2V0TmFtZSwge1xuICAgICAgICAgICAgICAgICAgICBidWNrZXROYW1lIDogcHJvcHMuYnVja2V0TmFtZVxuICAgICAgICAgICAgICAgICAgICxhY2Nlc3NDb250cm9sIDogXCJQcml2YXRlXCJcbiAgICAgICAgICAgICAgICAgICAsY29yc0NvbmZpZ3VyYXRpb24gOiB7XG4gICAgICAgICAgICAgICAgICAgICAgIGNvcnNSdWxlcyA6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbG93ZWRPcmlnaW5zIDogW1wiKlwiXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICxhbGxvd2VkSGVhZGVycyA6IFtcIipcIl1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsYWxsb3dlZE1ldGhvZHMgOiBbXCJHRVRcIixcIlBVVFwiLFwiUE9TVFwiLFwiREVMRVRFXCJdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgLHdlYnNpdGVDb25maWd1cmF0aW9uIDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXhEb2N1bWVudCA6ICdpbmRleC5odG1sJ1xuICAgICAgICAgICAgICAgICAgICAgICAsZXJyb3JEb2N1bWVudCA6ICdlcnJvci5odG1sJ1xuICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCc+Pj4gQ1JFQVRJTkcgQlVDS0VUOicscHJvcHMuYnVja2V0TmFtZSk7IFxuICAgICAgICAgICAgICAgIGJ1Y2tldCA9IG5ldyBDZm5CdWNrZXQodGhpcyxwcm9wcy5idWNrZXROYW1lLCB7XG4gICAgICAgICAgICAgICAgICAgICBidWNrZXROYW1lIDogcHJvcHMuYnVja2V0TmFtZVxuICAgICAgICAgICAgICAgICAgICAsYWNjZXNzQ29udHJvbCA6IFwiUHJpdmF0ZVwiXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwcm9wcy5yZXRhaW4pIGJ1Y2tldC5vcHRpb25zLmRlbGV0aW9uUG9saWN5ID0gRGVsZXRpb25Qb2xpY3kuUmV0YWluO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBidWNrZXQ7XG4gICAgfVxuXG4vKlxuICAgIHByaXZhdGUgY3JlYXRlQ2ZuQnVja2V0KGJ1Y2tldE5hbWU6IHN0cmluZywgaXNXZWI6IGJvb2xlYW4sIGFscmVhZHlFeGlzdHM6IGJvb2xlYW4pIDogQ2ZuQnVja2V0IHwgSUJ1Y2tldCB7XG5cbiAgICAgICAgbGV0IGJ1Y2tldCA6IENmbkJ1Y2tldCB8IElCdWNrZXQ7XG4gICAgICAgIGlmIChhbHJlYWR5RXhpc3RzKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnPj4+IElNUE9SVElORyBCVUNLRVQ6JyxidWNrZXROYW1lKTtcbiAgICAgICAgICAgIGJ1Y2tldCA9IHMzLkJ1Y2tldC5pbXBvcnQodGhpcywgYnVja2V0TmFtZSwge1xuICAgICAgICAgICAgICAgIGJ1Y2tldEFybiA6ICdhcm46YXdzOnMzOjo6JytidWNrZXROYW1lXG4gICAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGlzV2ViKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJz4+PiBDUkVBVElORyBXRUIgQlVDS0VUOicsYnVja2V0TmFtZSk7XG4gICAgICAgICAgICAgICAgYnVja2V0ID0gbmV3IENmbkJ1Y2tldCh0aGlzLGJ1Y2tldE5hbWUsIHtcbiAgICAgICAgICAgICAgICAgICAgYnVja2V0TmFtZSA6IGJ1Y2tldE5hbWVcbiAgICAgICAgICAgICAgICAgICAsYWNjZXNzQ29udHJvbCA6IFwiUHJpdmF0ZVwiXG4gICAgICAgICAgICAgICAgICAgLGNvcnNDb25maWd1cmF0aW9uIDoge1xuICAgICAgICAgICAgICAgICAgICAgICBjb3JzUnVsZXMgOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGxvd2VkT3JpZ2lucyA6IFtcIipcIl1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsYWxsb3dlZEhlYWRlcnMgOiBbXCIqXCJdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLGFsbG93ZWRNZXRob2RzIDogW1wiR0VUXCIsXCJQVVRcIixcIlBPU1RcIixcIkRFTEVURVwiXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICx3ZWJzaXRlQ29uZmlndXJhdGlvbiA6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4RG9jdW1lbnQgOiAnaW5kZXguaHRtbCdcbiAgICAgICAgICAgICAgICAgICAgICAgLGVycm9yRG9jdW1lbnQgOiAnZXJyb3IuaHRtbCdcbiAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgLHZlcnNpb25pbmdDb25maWd1cmF0aW9uIDoge1xuICAgICAgICAgICAgICAgICAgICAgICDCoHN0YXR1cyA6ICdTdXNwZW5kZWQnXG4gICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJz4+PiBDUkVBVElORyBCVUNLRVQ6JyxidWNrZXROYW1lKTsgXG4gICAgICAgICAgICAgICAgYnVja2V0ID0gbmV3IENmbkJ1Y2tldCh0aGlzLGJ1Y2tldE5hbWUsIHtcbiAgICAgICAgICAgICAgICAgICAgIGJ1Y2tldE5hbWUgOiBidWNrZXROYW1lXG4gICAgICAgICAgICAgICAgICAgICxhY2Nlc3NDb250cm9sIDogXCJQcml2YXRlXCJcbiAgICAgICAgICAgICAgICAgICAgLHZlcnNpb25pbmdDb25maWd1cmF0aW9uIDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgwqBzdGF0dXMgOiAnU3VzcGVuZGVkJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnVja2V0O1xuICAgIH1cblxuKi9cblxuXG5cbiAgICBjcmVhdGVCdWNrZXRzKCkge1xuICAgICAgICBsZXQgYXBwQnVja2V0TmFtZSA9IHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkudG9Mb3dlckNhc2UoKSArICcuYXBwJztcbiAgICAgICAgbGV0IHJhd0RhdGFCdWNrZXROYW1lID0gdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpICsgJy5yYXcnO1xuXG4gICAgICAgIGxldCBhcHBCdWNrZXQgPSB0aGlzLmNyZWF0ZUNmbkJ1Y2tldCgge1xuICAgICAgICAgICAgIGJ1Y2tldE5hbWUgOiBhcHBCdWNrZXROYW1lXG4gICAgICAgICAgICAsaXNXZWIgOiB0cnVlXG4gICAgICAgICAgICAsYWxyZWFkeUV4aXN0cyA6IHRoaXMucHJvcGVydGllcy5nZXRQYXJhbWV0ZXIoJ2V4aXN0aW5nYnVja2V0cycpLmluY2x1ZGVzKGFwcEJ1Y2tldE5hbWUpXG4gICAgICAgICAgICAscmV0YWluIDogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAvLyBsZXQgYXBwQnVja2V0ID0gdGhpcy5jcmVhdGVDZm5CdWNrZXQoYXBwQnVja2V0TmFtZSx0cnVlKTtcbiAgICAgICAgdGhpcy5hZGRSZXNvdXJjZSgnYXBwQnVja2V0JyxhcHBCdWNrZXQpO1xuXG4gICAgICAgIGxldCBjbG91ZEZyb250QWNjZXNzSWRlbnRpdHkgPSBuZXcgQ2ZuQ2xvdWRGcm9udE9yaWdpbkFjY2Vzc0lkZW50aXR5KHRoaXMsdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSsnQ0ROQWNjZXNzSWQnLCB7XG4gICAgICAgICAgICBjbG91ZEZyb250T3JpZ2luQWNjZXNzSWRlbnRpdHlDb25maWcgOiB7XG4gICAgICAgICAgICAgICAgLy8gVGhpcyBpcyB0aGUgbmFtZSBvZiB0aGUgaWRlbnRpdHlcbiAgICAgICAgICAgICAgICBjb21tZW50IDogdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKSsnQ0ROQWNjZXNzSWQnXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgbmV3IENmbkJ1Y2tldFBvbGljeSh0aGlzLHRoaXMucHJvcGVydGllcy5nZXRBcHBSZWZOYW1lKCkrXCJBcHBCdWNrZXRQb2xpY3lcIiwge1xuICAgICAgICAgICAgYnVja2V0IDogYXBwQnVja2V0LmJ1Y2tldE5hbWVcbiAgICAgICAgICAgLHBvbGljeURvY3VtZW50IDogbmV3IFBvbGljeURvY3VtZW50KClcbiAgICAgICAgICAgICAgIC5hZGRTdGF0ZW1lbnQoXG4gICAgICAgICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCgpXG4gICAgICAgICAgICAgICAgICAgLmFsbG93KClcbiAgICAgICAgICAgICAgICAgICAuYWRkQWN0aW9uKCdzMzpHZXRPYmplY3QnKVxuICAgICAgICAgICAgICAgICAgIC5hZGRSZXNvdXJjZShhcHBCdWNrZXQuYnVja2V0QXJuKycvKicpXG4gICAgICAgICAgICAgICAgICAuYWRkQXdzUHJpbmNpcGFsKCdhcm46YXdzOmlhbTo6Y2xvdWRmcm9udDp1c2VyL0Nsb3VkRnJvbnQgT3JpZ2luIEFjY2VzcyBJZGVudGl0eSAnK2Nsb3VkRnJvbnRBY2Nlc3NJZGVudGl0eS5jbG91ZEZyb250T3JpZ2luQWNjZXNzSWRlbnRpdHlJZClcbiAgICAgICAgICAgICAgICApXG4gICAgICAgIH0pO1xuICAgICAgICBsZXQgcmF3RGF0YUJ1Y2tldCA9IHRoaXMuY3JlYXRlQ2ZuQnVja2V0KHtcbiAgICAgICAgICAgICBidWNrZXROYW1lIDogcmF3RGF0YUJ1Y2tldE5hbWVcbiAgICAgICAgICAgICxhbHJlYWR5RXhpc3RzIDogdGhpcy5wcm9wZXJ0aWVzLmdldFBhcmFtZXRlcignZXhpc3RpbmdidWNrZXRzJykuaW5jbHVkZXMocmF3RGF0YUJ1Y2tldE5hbWUpXG4gICAgICAgICAgICAscmV0YWluIDogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5hZGRSZXNvdXJjZSgncmF3RGF0YUJ1Y2tldCcscmF3RGF0YUJ1Y2tldCk7XG4gICAgfVxuXG4gICAgZ2V0UmF3RGF0YUJ1Y2tldEFybigpIDogc3RyaW5nIHtcbiAgICAgICAgbGV0IHJhd0RhdGFCdWNrZXROYW1lID0gdGhpcy5wcm9wZXJ0aWVzLmdldEFwcFJlZk5hbWUoKS50b0xvd2VyQ2FzZSgpICsgJy5yYXcnO1xuICAgICAgICByZXR1cm4gJ2Fybjphd3M6czM6OjonK3Jhd0RhdGFCdWNrZXROYW1lO1xuICAgICAgICAvL3JldHVybiB0aGlzLnJhd0RhdGFCdWNrZXQuYnVja2V0QXJuO1xuICAgIH1cbn0iXX0=