echo CONFIGURING THE ENVIRONMENT
echo #############################
echo Updating the attached instance
sudo yum update -y
echo --
echo Updating node to the latest version
nvm install --lts
echo 
echo --
echo Installing CDK
npm install -g aws-cdk
echo --
echo Installing Typescript
npm install -g typescript
echo --
echo Installing dependencies
cd cdk
npm install
echo ### DONE