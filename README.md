# AWS Alien Attack Workshop

Welcome to the AWS Alien Attack workshop.   

The purpose of AWS Alien Attack is to create a fun environment where you can test and think about different aspects of serverless architectures for near real-time data processing pipelines at AWS. You can use Alien Attack to think, exercise, discuss, and talk about best practices for development, about security, databases, and so on.

Customers and [AWS Partners](https://aws.amazon.com/partners/) willing to schedule a private session (20+ attendees) should contact their respective Account Manager (AM), Partner Development Manager (PDM), AWS Solutions Architect (SA) or AWS Partner Solution Architect (PSA). The Immersion Day is delivered at no cost.

Please read the license terms inclosed.


![Markdown preferences pane](./images/alienattack.architecture.png)

<details><summary>
AWS Alien Attack runs very close at zero-cost for one user, but there is cost. Check more details about the services/products used in this list.</summary>

* **CDK**: AWS Alien Attack was built using CDK for the infrastructure deployment. To know more about CDK, check [what is CDK](https://docs.aws.amazon.com/CDK/latest/userguide/what-is.html), and visit its [github repository](https://github.com/awslabs/aws-cdk). Also, take some time to explore this [workshop](https://cdkworkshop.com/).
* **Cloud9**: Cloud9 it will be your "development environment". To know more about Cloud9, including pricing, click [here](https://aws.amazon.com/cloud9/). Cloud9 provides free tier.
* **Amazon Cognito**: Cognito is the service that we are using to provide identification and authentication services to AWS Alien Attack. To know more about Cognito, including pricing, click [here](https://aws.amazon.com/cognito/). Cognito provides free tier.
* **Amazon Identity and Access Management (IAM)**: IAM is a service that allows ytou to create and manage acess to AWS resources, and for Alien Attack we are using roles and polices alongside Cognito to provide the proper authorizations to the users. So, with Cognito and IAM, we cover identification, authentication, and authorization using RBAC (Role-Based Access Control). To learn more about IAM, go [here](https://aws.amazon.com/iam/). IAM is free.
* **Amazon S3**: S3 is used to host the website and to store the raw incoming data for analytics purposes. Read more about it [here](https://aws.amazon.com/s3/). S3 provides free tier.
* **Amazon API Gateway**: API Gateway will be the interface between the gamer and the back-end. To know more about it, go [here](https://aws.amazon.com/api-gateway/). API Gateway provides free tier.
* **AWS Lambda**: Lambda is the foundation for our processing layer. It allows you to run code without having to provision servers. To know more about it go [here](https://aws.amazon.com/lambda/). Lambda provides free tier.
* **Amazon Kinesis Data Stream**: Is the service that we use for ingesting streaming data. To know more about Kinesis Data Stream, including pricing, click [here](https://aws.amazon.com/kinesis/data-streams/). Kinesis Data Streams *has not free tier* , but the cost for this application, for 1 user, the cost associated to Kinesis Data Streams it will be of 1 cent per hour approximately.
* **Amazon Kinesis Data Firehose**: Amazon Kinesis Data Firehose is the easiest way to load streaming data into data stores and analytics tools. It can capture, transform, and load streaming data into Amazon S3, Amazon Redshift, Amazon Elasticsearch Service, and Splunk, enabling near real-time analytics with existing business intelligence tools and dashboards you’re already using today.  We are using it to drop data from Kinesis Data Streams to To know more about Kinesis Data Firehose, including pricing, click [here](https://aws.amazon.com/kinesis/data-firehose/). Kinesis Data Firehose *has not free tier* , but the cost for testing this application will be neglectable. Check the pricing model to learn more.
* **Amazon DynamoDB**: Is the database that we are using to store the scoreboard data for the game sessions. Amazon DynamoDB is s a key-value and document database that delivers single-digit millisecond performance at any scale. It's a fully managed, multiregion, multimaster database with built-in security, backup and restore, and in-memory caching for internet-scale applications. DynamoDB can handle more than 10 trillion requests per day and support peaks of more than 20 million requests per second. DynamoDB provides free tier, and we will be running under it for Alien Attack. To learn more about it, visit [this link](https://aws.amazon.com/dynamodb/).
* **AWS Systems Manager**: Systems Manager provides a unified user interface so you can view operational data from multiple AWS services and allows you to automate operational tasks across your AWS resources. We are using the [Parameter Store](https://aws.amazon.com/systems-manager/features/#Parameter_Store) feature of Systems Manager, which provides a centralized store to manage your configuration data, whether plain-text data such as database strings or secrets such as passwords. To know more about Systems Manager, including pricing, click [here](https://aws.amazon.com/systems-manager/).  Parameter store is free.
* At the *programming* side, we are using [AWS SDK for Javascript in the Browser](https://aws.amazon.com/sdk-for-browser/) and [AWS SDK for node](https://aws.amazon.com/sdk-for-node-js/). Alien Attack was not developed using the best practices, exaclty because one of the workshops is about fixing it and applying the best practices for programming and DevSecOps.
</details>












