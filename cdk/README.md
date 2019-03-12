# AWS Space Invaders CDK

**DISCLAIMER:** *AWS Space Invaders CDK, and all complementary resources are provided without any guarantees, and you're not recommended to use it for production-grade workloads. The intention is to provide content to build and learn.*

## What is this?

The AWS Space Invaders CDK is a fancy name for the Near Real-Time Application (even fancier!) workshop back-end. This is an on-going development.

## Requirements

To run these instructions do you need administrative access to AWS, and a machine properly configured with AWS CLI access, and with node installed.

We will be using AWS Cloud9 to run the following tasks, and that's why you will see `~/environment $` as a prompt. If you have experience configuring your own computer, move forward with and skip to STEP 2. If that's not your case, we recommend following the step 1.


## How to prepare the environment

#### STEP 1 - Launch your Cloud9 environment
1. On the AWS console, go to Cloud9. 
2. Launch Cloud9: 
  * 2.1. Go to the Cloud9 section of the console
  * 2.2. Select `Create environment`
  * 2.3. Give a name to your environment. **Important:** If you are sharing the same account and region with a colleague, be sure to take note of the identification of your environment, and be careful to not destroy your colleague environment.
  * 2.4. For the "environment settings":
   	 * 2.4.1. For "Environment type" choose `Create a new instance for environment (EC2)`
   	 * 2.4.2. For "Instance type" choose `t2.micro (1 GiB RAM + 1 vCPU)*`
   	 * 2.4.4. Leave the other configuration settings at their default values and click **Next step** and then **Create environment**

In a few seconds your environment will be available. You can close the Welcome tab on it.

#### STEP 2 - Updating your environment
1. Visit the [CDK Userguide](https://docs.aws.amazon.com/CDK/latest/userguide/install_config.html) and leave the page open so you can compare the versions that we will be indicated. It indicates the requirements and steps to install CDK. 
2. Check if the version of your *node* environment matches the minimum requirements specified at the CDk page, running the command `node -v`

For my case, for example, the result was the following one:  

~~~
~/environment $ node -v 
v6.16.0
~~~ 

3. So, I needed to upgrade it, or at least to install a compatible version. At this time, the required version for Node.js is >= 8.11.x. To find the versions available run the command `nvm ls-remote` and, on the resulting list, search for the one indicated as *Latest LTS*. For my case, it was v10.15.2. So, I will install it:  


```
~/environment $ nvm install --lts v10.15.2
Downloading https://nodejs.org/dist/v10.15.2/node-v10.15.2-linux-x64.tar.xz...
######################################################################################################################## 100.0%
Now using node v10.15.2 (npm v6.4.1)
~/environment $
```

#### STEP 3 - Installing CDK
Follow the steps indicated at the [CDK Install Config](https://docs.aws.amazon.com/CDK/latest/userguide/install_config.html), which possibly will be simply typing the command below. 

```
~/environment $ npm install -g aws-cdk
```

#### STEP 4 - Installing Typescript
```
 ~/environment $ npm install -g typescript
```

#### STEP 5 - Clone the repository and install the dependencies
Clone the repository

~~~

 ~/environment $ git clone https://fabianmartins@bitbucket.org/fabianmartins/awsspaceinvaders.cdk.git

~~~

(**IMPORTANT**) Get into the folder for the project

~~~
~/environment $ cd awsspaceinvaders.cdk
~/environment/awsspaceinvaders.cdk (master) $
~~~

Install the dependencies

~~~
~/environment/awsspaceinvaders.cdk (master) $ npm install
~~~

#### STEP 6 - Build the environment

There are two ways of building the environment: continuously, and on demand. 

On demand is done by typing running the following command on the terminal

~~~
~/environment/awsspaceinvaders.cdk (master) $ npm rum build
~~~

Continuously, the recommended approach, means that the environment will be compiled at every file change, so you can check possible errors right away.

One way of configuring it is by having 2 terminals open. One you will be using to issue commands. The other one, you will be using to monitor the progress of the development.

Lets configure it.

* At the bottom of the page of your Cloud9 IDE, click the **`(+)`** icon to add a second terminal.
* Considering that you are in the project folder, run `npm run watch` as follows

~~~ 
~/environment/awsspaceinvaders.cdk (master) $ npm run watch

> spaceinvaders.cdk@0.1.0 watch /home/ec2-user/environment/awsspaceinvaders.cdk
> tsc -w
[10:41:39 PM] Starting compilation in watch mode...

[10:41:52 PM] Found 0 errors. Watching for file changes.
~~~  

#### STEP 7 : Check the status of the compilation

Your environment must be free of errors, or the errors must be negligible, for you to move forward.

Negligible errors are those that appear when you comment parts of the code, and then the compiler indicates that some *imports* are unecessary. In general, these errors appear in the form of the TS6133 error:

~~~
- error TS6133: '<< some value >>' is declared but its value is never read.
~~~

For our case, this error will appear for the *ContentDeliveryLayer*. We commented an exerpt of code that makes the deployment of a CloudFront distribution for the enviroment. This code was commented because the deployment of CloudFront takes from 15-20 minutes, and it's not relevant for study. For a full deployment you can uncomment the code.

You may disregard this kind of error. 

For all other cases, you are expected to have something like the following

```
[5:54:49 PM] Found 0 errors. Watching for file changes.
```

#### STEP 8 : Deploying the environment

~~~ 
~/environment/awsspaceinvaders.cdk (master) $ cdk deploy

~~~  


## Appendix

### Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
