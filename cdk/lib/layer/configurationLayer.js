"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resourceawarestack_1 = require("./../resourceawarestack");
const ssm = require("@aws-cdk/aws-ssm");
/**
 * Configuration Layer is a construct designed to acquire and store configuration
 * data to be used by the system
 */
class ConfigurationLayer extends resourceawarestack_1.ResourceAwareConstruct {
    constructor(parent, name, props) {
        super(parent, name, props);
        if (props) {
            let parametersToBeCreated = props.getParameter('ssmParameters');
            if (parametersToBeCreated) {
                parametersToBeCreated.forEach((v, k) => {
                    let parameter = this.createParameter(props.getAppRefName(), k, v);
                    this.addResource('parameter.' + k, parameter);
                });
            }
        }
    }
    createParameter(appName, keyName, value) {
        let baseName = '/' + appName.toLowerCase();
        let parameter = new ssm.CfnParameter(this, 'SSMParameter' + appName + keyName, {
            name: baseName + '/' + keyName.toLowerCase(),
            type: 'String',
            value: value
        });
        return parameter;
    }
}
exports.ConfigurationLayer = ConfigurationLayer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvbkxheWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29uZmlndXJhdGlvbkxheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0EsZ0VBQXNGO0FBQ3RGLHdDQUF5QztBQUd6Qzs7O0dBR0c7QUFDSCxNQUFhLGtCQUFtQixTQUFRLDJDQUFzQjtJQUUxRCxZQUFZLE1BQWlCLEVBQUUsSUFBWSxFQUFFLEtBQTJCO1FBQ3BFLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzNCLElBQUksS0FBSyxFQUFFO1lBQ1AsSUFBSSxxQkFBcUIsR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ2hFLElBQUkscUJBQXFCLEVBQUU7Z0JBQ3ZCLHFCQUFxQixDQUFDLE9BQU8sQ0FBRSxDQUFDLENBQU8sRUFBRSxDQUFVLEVBQUUsRUFBRTtvQkFDbkQsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsYUFBYSxFQUFFLEVBQUMsQ0FBQyxFQUFVLENBQUMsQ0FBQyxDQUFDO29CQUN6RSxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksR0FBQyxDQUFDLEVBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQy9DLENBQUMsQ0FBQyxDQUFDO2FBQ047U0FDSjtJQUNMLENBQUM7SUFFTyxlQUFlLENBQUMsT0FBZ0IsRUFBRSxPQUFlLEVBQUUsS0FBYztRQUNyRSxJQUFJLFFBQVEsR0FBWSxHQUFHLEdBQUUsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ25ELElBQUksU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsY0FBYyxHQUFDLE9BQU8sR0FBQyxPQUFPLEVBQUU7WUFDdkUsSUFBSSxFQUFFLFFBQVEsR0FBRyxHQUFHLEdBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRTtZQUMxQyxJQUFJLEVBQUUsUUFBUTtZQUNkLEtBQUssRUFBRSxLQUFLO1NBQ2YsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxTQUFTLENBQUM7SUFDckIsQ0FBQztDQUNKO0FBeEJELGdEQXdCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ0Bhd3MtY2RrL2Nkayc7XG5pbXBvcnQgeyBSZXNvdXJjZUF3YXJlQ29uc3RydWN0LCBJUGFyYW1ldGVyQXdhcmVQcm9wcyB9IGZyb20gJy4vLi4vcmVzb3VyY2Vhd2FyZXN0YWNrJ1xuaW1wb3J0IHNzbSA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1zc20nKTtcblxuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gTGF5ZXIgaXMgYSBjb25zdHJ1Y3QgZGVzaWduZWQgdG8gYWNxdWlyZSBhbmQgc3RvcmUgY29uZmlndXJhdGlvblxuICogZGF0YSB0byBiZSB1c2VkIGJ5IHRoZSBzeXN0ZW1cbiAqL1xuZXhwb3J0IGNsYXNzIENvbmZpZ3VyYXRpb25MYXllciBleHRlbmRzIFJlc291cmNlQXdhcmVDb25zdHJ1Y3Qge1xuXG4gICAgY29uc3RydWN0b3IocGFyZW50OiBDb25zdHJ1Y3QsIG5hbWU6IHN0cmluZywgcHJvcHM6IElQYXJhbWV0ZXJBd2FyZVByb3BzKSB7XG4gICAgICAgIHN1cGVyKHBhcmVudCwgbmFtZSwgcHJvcHMpO1xuICAgICAgICBpZiAocHJvcHMpIHtcbiAgICAgICAgICAgIGxldCBwYXJhbWV0ZXJzVG9CZUNyZWF0ZWQgPSBwcm9wcy5nZXRQYXJhbWV0ZXIoJ3NzbVBhcmFtZXRlcnMnKTtcbiAgICAgICAgICAgIGlmIChwYXJhbWV0ZXJzVG9CZUNyZWF0ZWQpIHtcbiAgICAgICAgICAgICAgICBwYXJhbWV0ZXJzVG9CZUNyZWF0ZWQuZm9yRWFjaCggKHYgOiBhbnksIGsgOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBhcmFtZXRlciA9IHRoaXMuY3JlYXRlUGFyYW1ldGVyKHByb3BzLmdldEFwcFJlZk5hbWUoKSxrLDxzdHJpbmc+IHYpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZFJlc291cmNlKCdwYXJhbWV0ZXIuJytrLHBhcmFtZXRlcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9ICAgICAgIFxuXG4gICAgcHJpdmF0ZSBjcmVhdGVQYXJhbWV0ZXIoYXBwTmFtZSA6IHN0cmluZywga2V5TmFtZTogc3RyaW5nLCB2YWx1ZSA6IHN0cmluZykgeyAgICBcbiAgICAgICAgbGV0IGJhc2VOYW1lIDogc3RyaW5nID0gJy8nKyBhcHBOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGxldCBwYXJhbWV0ZXIgPSBuZXcgc3NtLkNmblBhcmFtZXRlcih0aGlzLCAnU1NNUGFyYW1ldGVyJythcHBOYW1lK2tleU5hbWUsIHtcbiAgICAgICAgICAgIG5hbWU6IGJhc2VOYW1lICsgJy8nK2tleU5hbWUudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgICAgIHR5cGU6ICdTdHJpbmcnLFxuICAgICAgICAgICAgdmFsdWU6IHZhbHVlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcGFyYW1ldGVyO1xuICAgIH1cbn1cbiJdfQ==