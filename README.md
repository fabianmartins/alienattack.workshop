# AWS Space Invaders Workshop

Welcome to the AWS Space Invaders workshop.

### Background story

*UnicornGames* is a company focused in designing games for entertainment and in implementing gamefication strategies for companies over different contexts, like sales tracking, investment performance tracking, and more.

We just bought the Space Invaders Unit from UnicornGames. Space Invaders seems to be only a simple game, but under the hood it is a near-real time processing engine that computes scores from a incoming stream of data, and we want to leverage for other purposes. The senior engineer at UnicornGames is not happy by being acquired, and so he left the company, leaving us with with a broken code that we need to fix. 

We were able to recover some instructions that we believe will help us to deploy the broken environment, and fix it. 

We hope that your skills may help us with the challenge of MAKING THE APPLICATION TO WORK.


## Instructions

### ACTIVITY 1 - Cloud9 - Prepare your environment

##### STEP 1 - Access your account
1. Login to your account
2. Select a region (take note of the region) - We recommend us-east-1 (Virginia) or us-east-2 (Oregon).

**IMPORTANT:** Be sure that you have permissions to create resources on your account. For the purpose of this workshop, having administrative privileges is the best option.

##### STEP 2 - Launch your Cloud9 environment
1. On the AWS console, go to Cloud9. 
2. Launch Cloud9:
2.1. Go to the Cloud9 section of the console
2.2. Select `Create environment`
2.3. Give a name to your environment. **Important:** If you are sharing the same account and region with a colleague, be sure to take note of the identification of your environment, and be careful to not destroy your colleague environment.
2.4. For the "environment settings":
2.4.1. For "Environment type" choose `Create a new instance for environment (EC2)`
2.4.2. For "Instance type" choose `t2.micro (1 GiB RAM + 1 vCPU)*`
2.4.4. Leave the other configuration settings at their default values and click **Next step** and then **Create environment**
2.4.5. In a few seconds your environment will be available. You can clouse the Welcome tab.

### ACTIVITY 2 - CDK - Deploy the back end

Clone the following repository, and follow the steps on it for the deployment.

Take note of the names that you used for *'appName'* and *'suffix'* that you used to deploy the application. These are going to be needed later.



### ACTIVITY X -  Deploy the application locally

If we're going to deploy the application appropriately, we need to test it locally first. Because of that, the environment is not deploying the CloudFront distribution. You can uncomment the section CLOUDFRONT DISTRIBUTION on the CDK and deploy it later.

We know that the application will not be working until we're be able to fix it. But, let's deploy it and save it for later.


### ACTIVITY X - Systems Manager - Create the parameters that are missing

There are parameters missing on the environment. Go to the Systems Manager console, and create the parameters as specified below.

Systems Manager provides you mechanisms to store parameters for your applications,  encrypted parameters for sensitive data, and more. Using the Parameter Store is free, and depending on the requirements more efficient than use a database to that. Know more here:

* Step 1 - On your console, visit the following services, and take note of the following data

Cognito
Identification of the user pool
Identification of the identity pool

### ACTIVITY X - DynamoDB - Create the missing table TopX

If you want to skip this activity, just go to the CDK Database Layer, and uncomment the code marked as MISSING TABLE and run CDK Deploy.

### ACTIVITY X - APIGateway - Fix the broken configuration on API Gateway to allow the application to consume the parameters

If you want to skip this activity, just go to the CDK Database Layer, and uncomment the code marked as MISSING METHOD and run CDK Deploy.

### ACTIVITY X - IAM - Fix the permissions of the Managers Cognito User group

If you want to skip this activity, just go to the CDK Database Layer, and uncomment the code marked as MISSING METHOD and run CDK Deploy.

### ACTIVITY X - Kinesis - Create the Kinesis Data Firehose to drop the incoming data into the raw data S3 bucket

### ACTIVITY X - Application - Fix the application configuration

On the folder where the application was downloaded, go to the folder `resources/config` and change it to have the following format

~~~
const DEBUG = true;
const AWS_CONFIG = {
    "region" : "<region where the env is deployed>",
    "API_ENDPOINT" : "<API Gateway invoke URL>/v1/",
    "APPNAME" : "<name of the application>"
}
~~~

Tips:

* To find the region is easy. Probably you already remember it. Optionally, you can go to your console and check the URL. It will be like `https://<region>.console.aws.amazon.com`. Another option

* https://78os8zlis9.execute-api.us-east-2.amazonaws.com/prod



### ACTIVITY X - Congito - Configure yourself as a manager

1. Take note of the USER POOL ID.
	* Visit your AWS console, go to Cognito, visit the user pools configuration, click on the user pool that has the same name as the one that you defined for your application, and take note of it (or copy it to a helper textfile)

2. Go to the terminal of your system, and run the following command. The command will add you to the group *Managers*, which will give you access to the 

	* Remember to be sure that you're operating on the right region.

~~~
$ aws cognito-idp admin-add-user-to-group --user-pool-id <userpoolid> --username <username that you used to register> --group-name Managers
~~~

IMPORTANT: This is another action that we DON'T WANT to be executed by hand. How to fix this? How to make the deployment of the environment to create an admin user automatically? Think about it. We will need it in another fixing workshop.


### ACTIVITY X - Test the application with friend


### ACTIVITY X - Celebrate


### ACTIVITY X - Cleaning up your environment

If we are aligned, considering every tasks executed, and we agreed in the standard names for the 










