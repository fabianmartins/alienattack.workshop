# AWS Space Invaders Workshop

Welcome to the AWS Space Invaders workshop (beta version).

### Background story

*UnicornGames* is a company focused in designing games for entertainment and in implementing gamefication strategies for companies over different contexts, like sales tracking, investment performance tracking, and more.

We just bought the Space Invaders Unit from UnicornGames. Space Invaders seems to be only a simple game, but under the hood it is a near-real time processing engine that computes scores from a incoming stream of data, and we want to leverage for other purposes. 

The Chief Development Engineer at UnicornGames is not happy by being acquired. He was expecting to become a VP and to buy part of the company. With our acquisition, he mutinied and left the company, taking some of the lead SDEs with him and leaving us with with broken code that we need to fix. 

We were able to recover some instructions that we believe will help us to deploy the broken environment, and fix it. 

We hope that your skills may help us with the challenge of MAKING THE APPLICATION TO WORK.


# Instructions

## Preparing the environment

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

~~~
cdk synth -c envname=<appName> -c suffix=<suffix>
~~~

~~~
cdk deploy -c envname=<appName> -c suffix=<suffix>
~~~



Take note of the names that you used for *'appName'* and *'suffix'* that you used to deploy the application. These are going to be needed later.

To avoid naming collisions, especially with S3 which has global namespace for buckets, we recommend choosing options that will avoid that. For instance, if you are running the deployment in a region without sharing the account with anyone else, pick your initials for *appName* and nothing for suffix. But, if you're sharing the account with someone - even in a different region - and by any reason you are using the same value for *appName*

Let's suppose that you selected appName=r2, and suffix=d2. Then, if the deployment is successful, at the end something like this will appear

***

 ✅  NRTAR2D2

Stack ARN:
arn:aws:cloudformation:<region>:<account>:stack/NRTAR2D2/bc543b91-451f-33f9-442a-02e473ddfb1a

if the deployment WAS NOT SUCCESSFUL, then almost surely you had a S3 bucket name collision. Call the support team to help you with that.

***


### ACTIVITY X -  Deploy the application locally

If we're going to deploy the application appropriately, we need to test it locally first. Because of that, the environment is not deploying the CloudFront distribution. You can uncomment the section CLOUDFRONT DISTRIBUTION on the CDK and deploy it later.

We know that the application will not be working until we're be able to fix it. But, let's deploy it and save it for later.

## Fix the application

Here is where we start fixing the environment.

The system is comprised of two applications: the Game, and the Scoreboard.

We know that the system is not running properly because we tried to run each one of the applications, and while with the console open on the browser, we could see a lot of errors, and it's clear that the application is broken.

As you will need to run application after fixing it (or now, just to check if it's really broken), here is the guidance for opening each one of the applications

* **Manager console**: using your browser, visit the folder where you installed the application, and open **`./scoreboard/index.html`**.
* **Game console**: using your browser, visit the folder where you installed the application, and open **`./game/index.html`**.

As it is not running, let's try to fix it using the following instructions.

### FIX ACTIVITY 1 - Application - Fix the application configuration

We got a tip from one of the developers that remained at the company that a config file is an important part of the application, and without being properly configured, the application will not run.

##### [Problem] 
The config file on the folder where the application was downloaded is invalid.

##### [Solution guidance]
Open the file `resources/js/awsconfig.js` and change it to have the following format

~~~
const DEBUG = true;
const AWS_CONFIG = {
    "region" : "<region where the env is deployed>",
    "API_ENDPOINT" : "<API Gateway invoke URL>/v1/",
    "APPNAME" : "<name of the application>"
}
~~~

Here is how to do it:

1. **region**: To find the region is easy. Probably you already remember it. Optionally, you can go to your console and check the URL. It will be like `https://<region>.console.aws.amazon.com`. 
2. **API_ENDPOINT**
  * Go to the AWS console, in the region that you deployed the environment, and then go to the service *API Gateway*. You will find an API with the name beginning with the name that you provided at the time of the deployment. Click on it.
  * Click on **stages**.
  * Click on **prod**.
  * At the top of the screen, on the right, you will see the **INVOKE URL**. It has the format `https://<API Id>.execute-api.<region>.amazonaws.com/prod`. When copying it to the required field in the awsconfig.js, don't forget to add the */v1/* at the end.
3. **APPNAME**: This one is easy. Just copy the values that you selected for *appName* and *suffix*. So, for instance, if you selected *r2* for appName, and *d2* for suffix, then the value for this field will be **R2D2**. For the sake of simplicity, from now and on we will use *appNamesuffix* to refer to this combination.

**IMPORTANT**  

* Don't forget to maintain the quotes that are on those fields.
* Save the file!


### FIX ACTIVITY 2 - Systems Manager - Create the parameter that is missing

One of the System Administrators took a look at the environment, and said that a parameter missing on the back-end. He said that we need to fix Systems ManagerGo to the Systems Manager console, and create the parameter as specified below.

**Systems Manager** provides you mechanisms to store parameters for your applications,  encrypted parameters for sensitive data, and more. Parameter Store is free and depending on the requirements, is cheaper and more efficient than using a database to store non-sensitive configuration data. Know more about the service [here](https://docs.aws.amazon.com/systems-manager/index.html), and specifically for parameter store [here](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html).

##### [Problem] 
It seems that a *'session'* parameter is missing, and making the application to break. This parameter holds the game session configuration, every time when the Manager creates a new session. The parameter must to exist on the back-end. We need to create it.

##### [Solution guidance]
1. On the AWS Console, go to Systems Manager.
2. Scroll down to the section *Shared Resources*, and click on `Parameter Store`. You will see some parameters starting with `/<appNamesuffix>/`, but there is no parameter `/<appNamesuffix>/session`. Let's create it.
3. On the top right of the page, click on **Create parameter**
4. On the section *Parameter details*, enter the following values:  
  * Name: `/<appNameSuffix>/session`
  * Description: `Existing session (opened or closed)`
  * Type: `string`
  * Value:  `null` (insert the word *null*).
5. Scroll down and click on **Create parameter**

If everything went well, you will get the message *Create parameter request succeeded*. Check if the parameter exists on the list of parameters.

#%%FIX THIS TIP%%
**Cheat tip**: If you want to skip this activity, just go to your CDK project, search for *MISSING PARAMETER* on all .ts files, and follow the guidance to adjust the code. Save everything and run `cdk diff` at the terminal.

### FIX ACTIVITY 3 - Kinesis Streams/Lambda Integration - Integrate Lambda to Kinesis

The people from the monitoring team said that they identified failure in getting the scoreboard computed and stored on DynamoDb. Our SysAdmin is friend of one of the rebels, and he send this message *"Check if the Lambda Function with the name Scoreboard is integrated to Kinesis. If there is no trigger configured for the lambda function, that's the issue"*.

##### [Problem] 
The game data is ingested to the Kinesis Streams.Then, Lambda (the service) triggers a Lambda function at each second, to make it consume the data from the Kinesis Streams. What is done with the consumed records depends on what is coded on the Lambda function.

We need to connect the Lambda function to Kinesis.

##### [Solution guidance]
1. Go to your AWS Console, and visit the Lambda service page.
2. Search for a function named **<appNamesuffix>ScoreboardFn**.  
3. Click on the name of the function. You will be taken to the configuration of the lambda function.
4. Check if the information sent from the rebel is correct. On the section named *Designer* if you see a message *"Add triggers from the list on the left"*, then the rebel is right. The trigger is missing. Let's create it.
5. On the left, on the section 'Add triggers', click on **Kinesis**. A section named *Configure triggers* will appear below.
6. Configure the fields:
   * **Kinesis stream**: Select the Kinesis Data Stream attached to your environment. The name must be in the form `<appNamesuffix>_InputStream`
   * **Consumer**: select *No consumer*
   * **Batch size**: insert the value *700*.
   * **Starting position**: select *Latest*.
   * Check box **Enable trigger**: leave it marked for now.
   * Click on the button **Add** at the right.
   * On the top, click on the button **Save**.

#%%FIX THIS TIP%%
**Cheat tip**: If you want to skip this activity, just go to your CDK project, search for *MISSING PARAMETER* on all .ts files, and follow the guidance to adjust the code. Save everything and run `cdk diff` at the terminal.


### FIX ACTIVITY 4 - Kinesis Firehose - Create the missing Kinesis Firehose

The analytics team complained that no data is going to their datalake staging area. They said that Kinesis Streams drops the data to a Kinesis Firehose, and then Kinesis Firehose moves the data to a S3 bucket named with the suffix "raw" (you can check if the bucket exists).

They said *"This is pretty simple! It is just to connect the Kinesis Firehose to the Kinesis Streams. If the Kinesis Firehose doesn't exists, create one! Give us access and we can help. Or, call us if you need"*.

So, follow the tip, and if you need help, call them.

##### [Problem] 
Check if there is a Kinesis Firehose attached to the Kinesis Streams, and point to the S3 bucket. Fix it, or create it properly.

##### [Solution guidance]
1. Go to your AWS Console, and visit the page of Kinesis (don't confuse it with Kinesis Video).
2. On the service page you are expected to see the Kinesis Streams on the left, and a missing Kinesis Firehose for the application. Let's create it.
3. Under the section *'Kinesis Firehose Delivery Streams*', or by clicking on *'Data Firehose*' at the left hand side, click on the button **Create Delivery Stream**.
4. On the section *New delivery stream*, configure the fields as follows:
   * **Delivery stream name**: `<appNamesuffix>Firehose`.
   * **Source**: Select the radio button *'Kinesis stream'*. 
   * Drop-down **Choose Kinesis stream**: select the stream attached to your deployment (the same one we connected to the Lambda function).
   * Click **Next**.
   * **Record transformation**: Select *'Disabled'*.
   * **Record format conversion**: Select *'Disabled'*.
   * Click **Next**.
   * **Destination**: Click S3, even if it's already selected.
   * **S3 bucket**: Select the bucket attached to your application. The name will have the form `<appNamesuffix>.raw`.
   * **S3 prefix**: Leave it blank
   * **S3 error prefix**: Leave it blank
   * Click **Next**
   * **Buffer size**: input the value *1*
   * **Buffer interval**: input the value *300*
   * **S3 compression**: Select *GZIP*
   * **S3 encryption**: Select *Disabled*
   * **Error logging**: Select *Enabled*
   * **IAM Role**: Click on the button *Create new or choose*. An IAM configuration page will open.
   		* *IAMRole*: Leave the option *Create a new IAM Role* selected.
   		* *Role Name*: `<appNamesuffix>FirehoseRole`
   		* Click on the button **Allow**. You will be taken to the previous page.
   	* Click **Next**.
   	* Check the presented configuration.
   	* Click on **Create delivery stream**.

If everything went well, you will see that the delivery stream was created.

#%%FIX THIS TIP%%
**Cheat tip**: If you want to skip this activity, just go to your CDK project, search for *MISSING PARAMETER* on all .ts files, and follow the guidance to adjust the code. Save everything and run `cdk diff` at the terminal.



### ACTIVITY X - IAM - Fix the permissions of the Managers Cognito User group

If you want to skip this activity, just go to the CDK Database Layer, and uncomment the code marked as MISSING METHOD and run CDK Deploy.


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










