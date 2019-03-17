# AWS Space Invaders Workshop

Welcome to the AWS Space Invaders workshop (beta version).

### Background story

*UnicornGames* is a company focused in designing games for entertainment and in implementing gamefication strategies for companies over different contexts, like sales tracking, investment performance tracking, and more.

We just bought the Space Invaders Unit from UnicornGames. Space Invaders seems to be only a simple game, but under the hood it is a near real-time application (NRTA) that computes scores from a incoming stream of data, and we want to leverage for other purposes. 

The Chief Development Engineer at UnicornGames is not happy by being acquired. He was expecting to become a VP and to buy part of the company. With our acquisition, he mutinied and left the company, taking some of the lead SDEs with him and leaving us with with broken code that we need to fix. 

We were able to recover some instructions that we believe will help us to deploy the broken environment, and fix it. 

We hope that your skills may help us with the challenge of MAKING THE APPLICATION TO WORK.


# Instructions

## Preparing the environment

### prepACTIVITY 1 - Cloud9 - Create your environment

#### STEP 1 - Access your account
1. Login to your account
2. Select a region (take note of the region) - We recommend us-east-1 (Virginia) or us-east-2 (Ohio)

**IMPORTANT:** Be sure that you have permissions to create resources on your account. For the purpose of this workshop, having administrative privileges is the best option.

#### STEP 2 - Launch your Cloud9 environment
1. On the AWS console, go to Cloud9. 
	* Go to the Cloud9 section of the console
	* Select **Create environment**
	* Give a name to your environment. **Important:** If you are sharing the same account and region with a colleague, be sure to take note of the identification of your environment, and be careful to not to destroy your colleague environment.
	* For the "environment settings":
		* For "Environment type" choose `Create a new instance for environment (EC2)`
		* For "Instance type" choose `t2.micro (1 GiB RAM + 1 vCPU)*`
		* Leave the other configuration settings at their default values and click **Next step**, and then **Create environment**

In a few seconds your environment will be available. You can close the Welcome tab.

#### <a name="config-cloneapprep"></a>STEP 3 - Clone this repository

Down on your Cloud9 console, a terminal is available. Go to the terminal and clone this repository. This repository contains the back-end.

~~~
~/environment $ git clone <this repository URL>
~~~

#### STEP 4 - Clone the application repository - ON YOUR COMPUTER

**This is supposed to be done on your local computer**. You can clone it at your Cloud9 environment, but for having a better experience, using your favorite browser, clone it in your own computer.

This is the repository with the Space Invaders front end.

**IMPORTANT:** Disregard any instructions at that repository.

~~~
 git clone https://github.com/fabianmartins/spaceinvaders.application.git
~~~

**IMPORTANT:** The frond-end DOES NOT WORK YET on mobile devices, and in some versions of Windows, especially those with touch screen.


#### STEP 5 - Update the environment

Back to your Cloud9 environment, let's update it.

1.Update the current machine  

~~~
sudo yum update -y
~~~

Don't worry about possible warnings.

2.Install the latest version of node

~~~
nvm install --lts
~~~

3.Installing Typescript

~~~
 npm install -g typescript
~~~

4.Installing CDK

~~~
npm install -g aws-cdk
~~~

5.Bootstraping CDK

5.1. Get the AWS account associated to this environment 

~~~
account=$(aws sts get-caller-identity --output text --query 'Account')
~~~

If you get the message *"Unable to locate credentials. You can configure credentials by running "aws configure"*, configure your AWS profile.  

5.3. Getting the region associated to the current credentials

~~~
region=$(aws configure get region)
~~~

5.4. Bootstrapping CDK

~~~
cdk bootstrap $account/$region
~~~

The bootstrap process creates in that region a bucket that CDK uses to deploy and run the Cloudformation specification.


6.Installing dependencies

Get into the cdk folder (I'm considering that you are at `~/environment $`)

~~~
cd spaceinvaders.workshop/cdk/
~~~

Install the dependencies

~~~
npm install
~~~


#### STEP 6 - Start background compiling for CDK

There are two ways of building the environment: *continuously*, and *on demand*. 

*On demand* is done by running `npm run build` from inside the cdk folder.

*Contiuous compiling*, the recommended approach, means that the environment will be compiled at every file change, so you can check possible errors right away.

One way of configuring continuous compiling is by having 2 terminals open. One you will be using to issue commands. The other one, you will be using to monitor the progress of the development and corresponding compilation.

Lets configure it.

* At the bottom of the page of your Cloud9 IDE, click the **`(+)`** icon, and then `New Terminal` to add a second terminal.
* Chose one of the terminals, and get into the cdk folder. If this is the new one, you will be at `~/environment`. So, from there:

~~~ 
~/environment $ cd cd spaceinvaders.workshop/cdk/
~/environment/spaceinvaders.workshop/cdk (master) $
~~~ 

* Kick off the continuous compiling of the environment. The output will come out with some errors. If these errors are of the type TS6192 or TS6133, then you're good. This errors appear

~~~ 
~/environment/spaceinvaders.workshop/cdk (master) $ npm run watch

[0:00:00 AM] Starting compilation in watch mode...


[0:00:14 AM] Found 0 errors. Watching for file changes.
~~~  


#### STEP 7 - Synthetize the cloudformation for your environment

Go to the other available terminal and be sure of being at the CDK folder

~~~
~/environment/spaceinvaders.workshop/cdk (master) $
~~~

You will need to decide for an **"Environment name"** and, optionally, for a **"suffix"**. These values will be used to configure your environment.

**My suggestions for you:**  
 
* **DON'T** use long names like *ThisIsMyEnvironmentName*, or *ThisIsAVeryLongAndUnecessarySuffixName*. Keep it simple. User something like Env01.
* If you're alone in the account/region, pick a small word for envname, like your initials, and *disregard* the suffix. 

The configuration was designed like this - having a name for the environment and a suffix - for the case when different individuals are sharing the same account (due their company's requirements) and sharing the same region (due the need of specific features of the AWS services, only available in such regions).

Yet, the values chosen for **"envname"** and **"suffix"** are used to create the buckets required by the application, so chose them in a way that most likely will avoid collision to S3 bucket names (which are global).

Let's suppose that you selected envname=r2, and suffix=d2. Then, if the deployment is successful, at the end something like this will appear

***

 ✅  NRTAR2D2

Stack ARN:
arn:aws:cloudformation:<region>:<account>:stack/NRTAR2D2/bc543b91-451f-33f9-442a-02e473ddfb1a

And the deployment will have created the buckets **nrtar2d2.app** and **nrtar2d2.raw**.

if the deployment WAS NOT SUCCESSFUL, then almost surely you had a S3 bucket name collision. if the message is similar to the one below, then chose another envname and/or suffix for your deployment. In the example below, the name TEST for the environment provokes a collision:

~~~
>>>> envname: TEST
>>>> providedSuffix: 
[ { Forbidden: null
      at Request.extractError (/home/ec2-user/environment/spaceinvaders.workshop/cdk/node_modules/aws-sdk/lib/services/s3.js:565:35)
      at Request.callListeners (/home/ec2-user/environment/spaceinvaders.workshop/cdk/node_modules/aws-sdk/lib/sequential_executor.js:106:20)
      at Request.emit (/home/ec2-user/environment/spaceinvaders.workshop/cdk/node_modules/aws-sdk/lib/sequential_executor.js:78:10)
      at Request.emit (/home/ec2-user/environment/spaceinvaders.workshop/cdk/node_modules/aws-sdk/lib/request.js:683:14)
      at Request.transition (/home/ec2-user/environment/spaceinvaders.workshop/cdk/node_modules/aws-sdk/lib/request.js:22:10)
      at AcceptorStateMachine.runTo (/home/ec2-user/environment/spaceinvaders.workshop/cdk/node_modules/aws-sdk/lib/state_machine.js:14:12)
      at /home/ec2-user/environment/spaceinvaders.workshop/cdk/node_modules/aws-sdk/lib/state_machine.js:26:10
      at Request.<anonymous> (/home/ec2-user/environment/spaceinvaders.workshop/cdk/node_modules/aws-sdk/lib/request.js:38:9)
      at Request.<anonymous> (/home/ec2-user/environment/spaceinvaders.workshop/cdk/node_modules/aws-sdk/lib/request.js:685:12)
      at Request.callListeners (/home/ec2-user/environment/spaceinvaders.workshop/cdk/node_modules/aws-sdk/lib/sequential_executor.js:116:18)
    message: null,
    code: 'Forbidden',
    region: 'ap-southeast-1',
    time: 2018-12-21T18:55:32.875Z,
    requestId: '99ECF0537A7B2AD1',
    extendedRequestId:
     'Qxeu5wF9wSXL6xHGMTLsFNq8Fo4b++6A9+Rh1BrG/qYY9k+w/FIU2fhpc+7hPMDiHgG3bohrUDI=',
    cfId: undefined,
    statusCode: 403,
    retryable: false,
    retryDelay: 133.93524816013246 } ]
Unable to find output file /tmp/cdkF6Q2pM/cdk.out; are you calling app.run()?
~~~

***

Being inside the cdk folder as shown below, ask CDK to synthetize the Cloudformation specification for your environment.

~~~
cdk synth -c envname=<envname> -c suffix=<suffix>
~~~


## Deploy your backend

Being at your cdk folder, and having decided for an *envname* and a *suffix*, run the following command:

~~~
cdk deploy -c envname=<envname> -c suffix=<suffix>
~~~

CDK will show you first what changes will be applied to the environment. After that, it will ask if you really want to deploy.

Answer with **y**.


## Fix the application

Here is where we start fixing the environment.

The system is comprised of two applications: the Game, and the Scoreboard.

We know that the system is not running properly because we tried to run each one of the applications, and while with the console open on the browser, we could see a lot of errors, and it's clear that the application is broken.

As you will need to run application after fixing it (or now, just to check if it's really broken), here is the guidance for opening each one of the applications. For this part, you will use the environment that you cloned **into your local computer** on the step ["Clone the application repository - ON YOUR COMPUTER"](#config-cloneapprep).

* **Manager console**: using your browser, visit the folder where you installed the application, and open **`./scoreboard/index.html`**.
* **Game console**: using your browser, visit the folder where you installed the application, and open **`./game/index.html`**.

As it is not running, let's try to fix it using the following instructions.

### fixACTIVITY 1 - Application - Fix the application configuration

We got a tip from one of the developers that remained at the company that a config file is an important part of the application, and without being properly configured, the application will not run.

##### [Problem] 
The config file for the downloaded application is invalid.

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

1. **region**: To find the region is easy. Probably you still remember it, or you can get it from the last message of the CDK deployment. Optionally, you can go to your console and check the URL. It will be like `https://<region>.console.aws.amazon.com`. 
2. **API_ENDPOINT**
  * Go to the AWS console, in the region that you deployed the environment, and then go to the service *API Gateway*. You will find an API with the name beginning with the name that you provided at the time of the deployment. Click on it.
  * Click on **Stages**.
  * Click on **prod**.
  * At the top of the screen, on the right, you will see the **INVOKE URL**. It has the format `https://<API Id>.execute-api.<region>.amazonaws.com/prod`. When copying it to the required field in the awsconfig.js, don't forget to add the */v1/* at the end.
3. **APPNAME**: This one is easy. Just copy the values that you selected for *envName* and *suffix*. So, for instance, if you selected *r2* for envName, and *d2* for suffix, then the value for this field will be **R2D2**. For the sake of simplicity, from now and on we will use *envNamesuffix* to refer to this combination.

**IMPORTANT**  

* Don't forget to maintain the quotes that are on those fields.
* Save the file!


### fixACTIVITY 2 - Systems Manager - Create the missing parameter

One of the System Administrators took a look at the environment, and he said that a parameter missing on the back-end. He said that we need to fix Systems Manager. Go to the Systems Manager console, and create the parameter as specified below.

**Systems Manager** provides you mechanisms to store parameters for your applications,  encrypted parameters for sensitive data, and more. Parameter Store is free and depending on the requirements, is cheaper and more efficient than using a database to store non-sensitive configuration data. Know more about the service [here](https://docs.aws.amazon.com/systems-manager/index.html), and specifically for parameter store [here](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html).

##### [Problem] 
It seems that a *'session'* parameter is missing, and making the application to break. This parameter holds the game session configuration, every time when the Manager creates a new session. The parameter must exist on the back-end. We need to create it.

##### [Solution guidance]
1. On the AWS Console, go to Systems Manager.
2. Scroll down to the section *Shared Resources*, and click on `Parameter Store`. You will see some parameters starting with `/<envNamesuffix>/`, but there is no parameter `/<envNamesuffix>/session`. Let's create it.
3. On the top right of the page, click on **Create parameter**
4. On the section *Parameter details*, enter the following values:  
  * Name: `/<envNamesuffix>/session`
  * Description: `Existing session (opened or closed)`
  * Type: `String`
  * Value:  `null` (insert the word *null*).
5. Scroll down and click on **Create parameter**

If everything went well, you will get the message *Create parameter request succeeded*. Check if the parameter exists on the list of parameters.

**-- FastFix --**  
If you want to skip this activity: 

1. Go your CDK project, search for *MISSING PARAMETER* on all .ts files, and follow the guidances to adjust the code.
2. Save everything and run **`cdk diff -c envname=<envName> -c suffix=<suffix>`** at the terminal. This will show you what will be changed on your environment
3. If you agree with the changes, run **`cdk deploy -c envname=<envName> -c suffix=<suffix>`** to deploy the changes


### fixACTIVITY 3 - Kinesis Streams/Lambda Integration - Integrate Lambda to Kinesis

The people from the monitoring team said that they identified failure in getting the scoreboard computed and stored on DynamoDb. Our SysAdmin is friend of one of the rebels, and he send this message *"Check if the Lambda Function with the name Scoreboard is integrated to Kinesis. If there is no trigger configured for the lambda function, that's the issue"*.

##### [Problem] 
The game data is ingested to the Kinesis Streams.Then, Lambda (the service) triggers a Lambda function at each second, to make it consume the data from the Kinesis Streams. What is done with the consumed records depends on what is coded on the Lambda function.

We need to connect the Lambda function to Kinesis.

##### [Solution guidance]
1. Go to your AWS Console, and visit the Lambda service page.
2. Search for a function named **`<envNamesuffix>ScoreboardFn`**.  
3. Click on the name of the function. You will be taken to the configuration of the lambda function.
4. Check if the information sent from the rebel is correct. On the section named *Designer* if you see a message *"Add triggers from the list on the left"*, then the rebel is right. The trigger is missing. Let's create it.
5. On the left, on the section 'Add triggers', click on **Kinesis**. A section named *Configure triggers* will appear below.
6. Configure the fields:
   * **Kinesis stream**: Select the Kinesis Data Stream attached to your environment. The name must be in the form `<envNamesuffix>_InputStream`
   * **Consumer**: select *No consumer*
   * **Batch size**: insert the value *700*.
   * **Starting position**: select *Latest*.
   * Check box **Enable trigger**: leave it marked for now.
   * Click on the button **Add** at the right.
   * On the top, click on the button **Save**.

**-- FastFix --**  
If you want to skip this activity: 

1. Go your CDK project, search for *MISSING KINESIS INTEGRATION* on all .ts files, and follow the guidances to adjust the code.
2. Save everything and run **`cdk diff -c envname=<envName> -c suffix=<suffix>`** at the terminal. This will show you what will be changed on your environment
3. If you agree with the changes, run **`cdk deploy -c envname=<envName> -c suffix=<suffix>`** to deploy the changes


### fixACTIVITY 4 - Kinesis Firehose - Create the missing Kinesis Firehose

The analytics team complained that no data is going to their data lake staging area. They said that Kinesis Streams drops the data to a Kinesis Firehose, and then Kinesis Firehose moves the data to a S3 bucket named with the suffix "raw" (you can check if the bucket exists).

They said *"This is pretty simple! It is just to connect the Kinesis Firehose to the Kinesis Streams. If the Kinesis Firehose doesn't exists, create one! Give us access and we can help. Or, call us if you need"*.

So, follow the tip, and if you need help, call them.

##### [Problem] 
Check if there is a Kinesis Firehose attached to the Kinesis Streams, and point to the S3 bucket. Fix it, or create it properly.

##### [Solution guidance]
1. Go to your AWS Console, and visit the page of Kinesis (don't confuse it with Kinesis Video).
2. On the service page you are expected to see the Kinesis Streams on the left, and a missing Kinesis Firehose for the application. Let's create it.
3. Under the section *'Kinesis Firehose Delivery Streams*', or by clicking on *'Data Firehose*' at the left hand side, click on the button **Create Delivery Stream**.
4. On the section *New delivery stream*, configure the fields as follows:
   * **Delivery stream name**: `<envNamesuffix>Firehose`.
   * **Source**: Select the radio button *'Kinesis stream'*. 
   * Drop-down **Choose Kinesis stream**: select the stream attached to your deployment (the same one we connected to the Lambda function).
   * Click **Next**.
   * **Record transformation**: Select *'Disabled'*.
   * **Record format conversion**: Select *'Disabled'*.
   * Click **Next**.
   * **Destination**: Click S3, even if it's already selected.
   * **S3 bucket**: Select the bucket attached to your application. The name will have the form `<envNamesuffix>.raw`.
   * **S3 prefix**: Leave it blank
   * **S3 error prefix**: Leave it blank
   * Click **Next**
   * **Buffer size**: input the value *1*
   * **Buffer interval**: input the value *300*
   * **S3 compression**: Select *GZIP*
   * **S3 encryption**: Select *Disabled*
   * **Error logging**: Select *Enabled*
   * **IAM Role**: Click on the button `Create new or choose`. An IAM configuration page will open.
   		* *IAMRole*: Leave the option *Create a new IAM Role* selected.
   		* *Role Name*: `<envNamesuffix>FirehoseRole`
   		* Click on the button **Allow**. You will be taken to the previous page.
   	* Click **Next**.
   	* Check the presented configuration.
   	* Click on **Create delivery stream**.

If everything went well, you will see that the delivery stream was created.

**-- FastFix --**  
If you want to skip this activity: 

1. Go your CDK project, search for *MISSING KINESIS FIREHOSE* on all .ts files, and follow the guidances to adjust the code.
2. Save everything and run **`cdk diff -c envname=<envName> -c suffix=<suffix>`** at the terminal. This will show you what will be changed on your environment
3. If you agree with the changes, run **`cdk deploy -c envname=<envName> -c suffix=<suffix>`** to deploy the changes


### fixACTIVITY 5 - Congito - Fix the permissions on the groups for RBAC

The people from the Security Team that joined our taskforce to solve the issues said that is essential that RBAC (Role-Based Access Control) is properly configured on the system. They also said that the current version of the CDK doesn't allow us to solve that by code, unless we create a Custom Resource as it was done for the creation of the User Pool. Nobody on the team knows how to do it, but one of the SysAdmins said that he has a playbook for that, and send us the guidance. Let's try to leverage it.

##### [Problem] 
The Identity Pool configuration is missing the configuration of the roles for each one of the groups (Managers and Players). We need to attach the proper roles to the user when the user signs in to the application.

##### [Solution guidance 1]

1. On your AWS Console, visit the Cognito service page.
2. If you got to the landing page of the service, you will click on the button **Manage Identity Pools**.
3. You will see an Identity Pool named as `<envNamesuffix>`. Click on it.
4. On the top right, there is a very discreet label entitled `Edit Identity Pool`. Click on it.
5. Open the section `Authentication Providers`
6. Click on the tab `Cognito` just to be sure that you have it selected
7.  On the section `Authenticated role selection` there is a select button labeled as `Use default role`. Click on this button and select **Choose role with rules**. We will create two rules
8. First rule - **MANAGERS**
	* For the field `Claim`, input the value **cognito:preferred_role**
	* For the drop down box at the right side of the field, leave the value **Contains** selected
	* For the input box at the right of the `Contains` box, input the value **`<envNameprefix>ManagersRole`**. Be careful with typos, and respect the uppercase/lowercase.
	* For the drop down box on the right, select **`<envNameprefix>ManagersRole`**
9. Second rule - **PLAYERS**
	* For the field `Claim`, input the value **cognito:preferred_role**
	* For the drop down box at the right side of the field, leave the value **Contains** selected
	* For the input box at the right of the `Contains` box, input the value **`<envNameprefix>PlayersRole`**. Be careful with typos, and respect the uppercase/lowercase.
	* For the drop down box on the right, select **`<envNameprefix>PlayersRole`**
10. **Role resolution**: Select **`Deny`**
11. Leave everything else as it is and click on **`Save changes`**

**-- FastFix --**  
The fast fix for this step requires a series of steps. All of these steps where condensed into the file `fixcognito.sh` which is inside the folder `~/environment/spaceinvaders.workshop`. Go to that folder, and run the following command:

~~~
./fixcognito.sh <envname> <suffix>
~~~

### fixACTIVITY 6 - Test the registration process

If all the steps were executed properly, the application must be running. Let's try to create an user.

This steps are going to be executed using the respository that you cloned to your local computer.

1. Confirm that you executed the Fix Activity 1. The file `./resources/js/aws_config.js` must be properly configured.
2. Open a privacy/incognito page for your browser. This will guarantee that you will have the cookies cleared after use.
3. Open this file that is on your application deployment: `./game/index.html`
4. If everything was ok, and the application was able to retrieve the configurations, you will see a page with the buttons `Register` and `Login`. Choose **Register**
5. Register yourself filling the fields properly
	* **Username**: Define a username. Use only lowercase letters and don't use symbols
	* **e-mail**: You will need a valid and accessible email. Cognito needs to send you a confirmation email and you will need to click on it to confirm
	* **Password**: For testing purposes, use a simple password (like `abc123`). This password is managed by Cognito. So, it's not stored on any application database
	* **Confirm (and memorize) your password**: Repeat your password
	* **Your company's web domain (ex: aws.amazon.com)**: Input your company domain.
	* Click on the button **Register**
6. If everything went well, you will receive a confirmation on your email. Open the email and click on the link.

### fixACTIVITY 7 - Test the login process

1. Get back to the application, and now choose **Login** 
2. Enter your credentials, and click on **Login**
3. If you entered your credentials right, you will see a pop-up message `Login successful to user <username>`
4. If you get to a page where the indicating status is WAITING and you have a counting down from 10 to 0 that keeps restarting, everything is ok.
5. Close the window, to be sure that the cookies were deleted, so we can proceed with the test.

### fixACTIVITY 8 - Test the manager console

The manager console is where the manager creates a session, and starts the game so other participants can join it.

We've been said that these applications is needing a face lifting. However, let's leave the cosmetics for another opportunity.

This steps are going to be executed using the respository that you cloned to your local computer.

1. Open a privacy/incognito page for your browser. This will guarantee that you will have the cookies cleared after use.
2. Open this file that is on your application deployment: `./scoreboard/index.html`
3. The page will show some fields for you to enter the username and password that you defined earlier. Do it
4. If the application indicates `AccessDeniedException`, then we have an access problem. If that's the case, go to the next activity.


### fixACTIVITY 9 - Cognito - Configure yourself as a manager

We found some notes at the desk of the solution architect. There is a piece of paper where is written *"use AWS CLI to make yourself an application admin"*. The following steps are were found that paper. Hopefully they will help you to solve the issue.

**Task 1.** Take note of the USER POOL ID  

1. Visit your AWS console, and go to Cognito
2. Click on **Manager User Pools**
3. Click on the user pool that has the same name as the one that you defined for your application (`envNameSuffix`)
4. Take note of the *Pool Id* (or copy it to a helper text file)

**Task 2.** Use AWS CLI to include your username into the Managers group  

1. Go to the terminal of your Cloud9 environment - or on your computer, with AWS CLI credentials properly configured with administrative permissions.
2. Run the command below. The command will add you to the group *Managers*, which will give you access to the Scoreboard Manager resources
3. Get back to the manager console, and try access it again

~~~
$ aws cognito-idp admin-add-user-to-group --user-pool-id <userpoolid> --username <username that you used to register> --group-name Managers --region <region>
~~~


**IMPORTANT**: This is another action that we DON'T WANT to be executed by hand. How to fix this? How to make the deployment of the environment to create an admin user automatically? Think about it. We will need it in another fixing workshop.


### fixACTIVITY 10 - Create a session for the game

If the previous activity went well, you have the management console ready to have a session configured.

Execute again the steps of the **fixAcitivy 8*. You are not going to get a AccessDeniedException. 

Follow the steps below to create a gaming session.

1. On the field `Session Name` input **TEST**
2. On the section `Game Type`, select **Multiple trials**
3. Click on the button **Start game**
4. If the page updates with a table containing a header with the words `Nickname`, `Score`, `Shots`, `Level`, `Lives`, then we are good.
5. Open a second browser window, and execute again the steps to login into the game. For a better experience, leave the windows opened side by side. This time, if everything went well, you will see a button labeled **JOIN session**. Click on it 

If you are able to play, **you fixed it!**

Play a little bit. Check the scoreboard. Check the DynamoDB tables. Check the S3 buckets after some time.

For a full deployment, you will need to install the application at the S3 folder with the suffix.app. You will also need to deploy the CloudFront distribution because the S3 buckets are not public.

To solve this, go to the file `mainLayer.ts` which is on the deployment at Cloud9, search for *MISSING CLOUDFRONT DISTRIBUTION* and uncomment it at that file. The deployment it will take something around 20 minutes. Same time it will be required for the undeployment.


## Cleaning up the environment

### cleanACTIVITY 1 - Destroy the deployed environment

Go to the the terminal on your environment and type the following command. Be sure to be at your cdk folder.

**IMPORTANT:** Be sure of using UPPERCASE both for ENVNAME and SUFFIX.

```
$ cdk destroy -c envname=<envName> -c suffix=<suffix>
```

If everything went well, you will receive a message like the following one: 

```
✅  NRTA<envNamesuffix>: destroyed
```

### cleanACTIVITY 2 - Cleaning up the last resources

Everything that was created by CloudFormation was deleted, with the exception of the buckets. Additionaly, the resources that you created directly on the console were not deleted. 

Let's fix this.

1. Go to Systems Manager, then Parameter Store, and delete the parameter `<envNamesuffix>/session`
2. Go to Kinesis, then Kinesis Firehose, and delete the resource that you created by hand
3. Go to IAM, and search for `<envNamesuffix>`. Delete any resource configured like that. For sure the only resource will be `<envNamesuffix>FirehoseRole`
4. Delete the S3 buckets `<envNamesuffix>`.app and `<envNamesuffix>.raw`
5. Delete your Cloud9 environment if you created it just for this workshop.

## Final activity

Celebrate! You deserve it!












