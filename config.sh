echo CONFIGURING THE ENVIRONMENT
echo #############################
echo Updating the attached instance
sudo yum update -y
echo --
echo Updating node to the latest version
source ~/.nvm/nvm.sh
nvm install --lts
echo --
echo Installing Typescript
npm install -g typescript
echo --
echo Installing CDK
npm install -g aws-cdk
echo --
echo Bootstraping CDK
account=$(aws sts get-caller-identity --output text --query 'Account')
region=$(aws configure get region)
cdk bootstrap $account/$region
echo --
echo Installing dependencies
cd cdk
npm install
echo ### DONE