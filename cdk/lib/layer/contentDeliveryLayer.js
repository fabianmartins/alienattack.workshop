"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resourceawarestack_1 = require("./../resourceawarestack");
const aws_cloudfront_1 = require("@aws-cdk/aws-cloudfront");
const aws_s3_1 = require("@aws-cdk/aws-s3");
class ContentDeliveryLayer extends resourceawarestack_1.ResourceAwareConstruct {
    constructor(parent, name, props) {
        super(parent, name, props);
        this.createDistribution(props);
    }
    createDistribution(props) {
        let s3BucketOrCnfBucket = props.getParameter('appBucket');
        let s3Bucket = aws_s3_1.Bucket.import(this, props.getAppRefName() + 'ImportedBucket', {
            bucketName: s3BucketOrCnfBucket.bucketName
        });
        new aws_cloudfront_1.CloudFrontWebDistribution(this, props.getAppRefName(), {
            originConfigs: [
                {
                    s3OriginSource: {
                        s3BucketSource: s3Bucket
                    },
                    behaviors: [{ isDefaultBehavior: true }]
                }
            ]
        });
    }
}
exports.ContentDeliveryLayer = ContentDeliveryLayer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudERlbGl2ZXJ5TGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb250ZW50RGVsaXZlcnlMYXllci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBLGdFQUFzRjtBQUN0Riw0REFBb0U7QUFDcEUsNENBQXlDO0FBR3pDLE1BQWEsb0JBQXFCLFNBQVEsMkNBQXNCO0lBRTVELFlBQVksTUFBaUIsRUFBRSxJQUFZLEVBQUUsS0FBMkI7UUFDcEUsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0IsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxLQUEyQjtRQUVsRCxJQUFJLG1CQUFtQixHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDMUQsSUFBSSxRQUFRLEdBQVksZUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLGFBQWEsRUFBRSxHQUFDLGdCQUFnQixFQUFFO1lBQ2hGLFVBQVUsRUFBRyxtQkFBbUIsQ0FBQyxVQUFVO1NBQzlDLENBQUMsQ0FBQztRQUVILElBQUksMENBQXlCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxhQUFhLEVBQUUsRUFBRTtZQUN2RCxhQUFhLEVBQUU7Z0JBQ1g7b0JBQ0ksY0FBYyxFQUFFO3dCQUNYLGNBQWMsRUFBRSxRQUFRO3FCQUM1QjtvQkFDRCxTQUFTLEVBQUcsQ0FBRSxFQUFDLGlCQUFpQixFQUFFLElBQUksRUFBQyxDQUFDO2lCQUMzQzthQUNKO1NBQ0gsQ0FBQyxDQUFDO0lBR1IsQ0FBQztDQUNKO0FBM0JELG9EQTJCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ0Bhd3MtY2RrL2Nkayc7XG5pbXBvcnQgeyBSZXNvdXJjZUF3YXJlQ29uc3RydWN0LCBJUGFyYW1ldGVyQXdhcmVQcm9wcyB9IGZyb20gJy4vLi4vcmVzb3VyY2Vhd2FyZXN0YWNrJ1xuaW1wb3J0IHsgQ2xvdWRGcm9udFdlYkRpc3RyaWJ1dGlvbiB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCB7IEJ1Y2tldCB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1zMyc7XG5cblxuZXhwb3J0IGNsYXNzIENvbnRlbnREZWxpdmVyeUxheWVyIGV4dGVuZHMgUmVzb3VyY2VBd2FyZUNvbnN0cnVjdCB7XG5cbiAgICBjb25zdHJ1Y3RvcihwYXJlbnQ6IENvbnN0cnVjdCwgbmFtZTogc3RyaW5nLCBwcm9wczogSVBhcmFtZXRlckF3YXJlUHJvcHMpIHtcbiAgICAgICAgc3VwZXIocGFyZW50LCBuYW1lLCBwcm9wcyk7XG4gICAgICAgIHRoaXMuY3JlYXRlRGlzdHJpYnV0aW9uKHByb3BzKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNyZWF0ZURpc3RyaWJ1dGlvbihwcm9wczogSVBhcmFtZXRlckF3YXJlUHJvcHMpIHtcblxuICAgICAgICBsZXQgczNCdWNrZXRPckNuZkJ1Y2tldCA9IHByb3BzLmdldFBhcmFtZXRlcignYXBwQnVja2V0Jyk7XG4gICAgICAgIGxldCBzM0J1Y2tldCA9IDxCdWNrZXQ+IEJ1Y2tldC5pbXBvcnQodGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpKydJbXBvcnRlZEJ1Y2tldCcsIHtcbiAgICAgICAgICAgIGJ1Y2tldE5hbWUgOiBzM0J1Y2tldE9yQ25mQnVja2V0LmJ1Y2tldE5hbWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmV3IENsb3VkRnJvbnRXZWJEaXN0cmlidXRpb24odGhpcywgcHJvcHMuZ2V0QXBwUmVmTmFtZSgpLCB7XG4gICAgICAgICAgICBvcmlnaW5Db25maWdzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzM09yaWdpblNvdXJjZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgIHMzQnVja2V0U291cmNlOiBzM0J1Y2tldFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBiZWhhdmlvcnMgOiBbIHtpc0RlZmF1bHRCZWhhdmlvcjogdHJ1ZX1dXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICAgfSk7XG5cblxuICAgIH1cbn0iXX0=