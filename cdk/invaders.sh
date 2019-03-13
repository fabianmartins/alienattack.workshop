## This script solves a few points that are not yet
## resolved by CDK, and act as a bridge to deploy and to destroy
## the environment

### TO-DOS
## 1. Download and publish the application
## 2. Update the application into the bucket
## 3. Update the ./resources/awsconfig.js file in the application
## const DEBUG = true;
## const AWS_CONFIG = {
##     "region" : "us-east-1",
##     "API_ENDPOINT" : "https://d43ad4bb10.execute-api.us-east-1.amazonaws.com/prod/v1/"
## }

_DEBUG="on"

function DEBUG() {
    [ "$_DEBUG" == "on" ]  && $@
}

function help() {
cat << EOF


     Welcome to
     A W S  S P A C E  I N V A D E R S
     A        Serverless     Adventure                                                    

     COMMANDS                                   Purpose
     ---------------------------------------    ---------------------------------------------
     invaders configure                         ; configure your environment to run CDK
                                                ; after configure you can use CDK commands
     
     invaders deploy                            ; deploy the environment using NRTA as name
     invaders deploy  [<envName>]               ; deploy the environment using 'envName' as name
     invaders deploy  <envname> <suffix>        ; deploy the environment using 'envNamesuffix' as name
    
     invaders destroy                           ; destroy the environment NRTA
     invaders destroy  [<envName>]              ; destroy the environment 'envName'
     invaders destroy  <envname> <suffix>       ; deploys the environment using 'envNamesuffix' as name
    
     invaders install <local | remote>          ; installs the application locally on ./output/tempapp or to your app Bucket
    
     invaders makeadmin <username>              ; makes the user 'username' an admin (NOT IMPLEMENTED)

EOF
}

function removeQuotes() {
    retval=$1
    retval=${retval#\"}
    retval=${retval%\"}
    echo "$retval"
}

function setRoleMappings() {
    envName=$1
    suffix=$2
    appName=$envName$suffix
    echo 
    echo "Setting Role Mappings for envName: "$appName

    getPlayersRole=$(echo aws "iam list-roles --query 'Roles[?contains(RoleName,\`"$appName"PlayersRole\`)].Arn|[0]'")
    playersRoleArn=$(removeQuotes $( eval $getPlayersRole ))
    DEBUG echo $playersRoleArn

    getManagersRole=$(echo aws "iam list-roles --query 'Roles[?contains(RoleName,\`"$appName"ManagersRole\`)].Arn|[0]'")
    managersRoleArn=$(removeQuotes $( eval $getManagersRole ))
    DEBUG echo $managersRoleArn

    getUnauthRole=$(echo aws "iam list-roles --query 'Roles[?contains(RoleName,\`"$appName"UnauthRole\`)].Arn|[0]'")
    unauthRoleArn=$(removeQuotes $( eval $getUnauthRole ))
    DEBUG echo $unauthRoleArn

    getIdentityPool=$(echo aws "cognito-identity list-identity-pools --max-results 11 --query 'IdentityPools[?starts_with(IdentityPoolName,\`"$appName"\`)]|[0].IdentityPoolId'")
    identityPoolId=$( removeQuotes $( eval $getIdentityPool ) )
    DEBUG echo $identityPoolId

    getCognitoProviderName=$(echo "aws cognito-identity describe-identity-pool --identity-pool-id "$identityPoolId" --query 'CognitoIdentityProviders[0].ProviderName'")
    cognitoProviderName=$( removeQuotes $( eval $getCognitoProviderName ) )
    DEBUG echo $cognitoProviderName

    #aws cognito-idp list-identity-providers --user-pool-id us-east-2_nMp73BoqG
    getUserPoolId=$(echo "aws cognito-idp list-user-pools --query 'UserPools[?Name == \`"$appName"\`]|[0].Id' --max-results=1")
    userPoolId=$( removeQuotes $( eval $getUserPoolId ) )
    DEBUG echo $userPoolId

    clientId=$( removeQuotes $(aws cognito-idp list-user-pool-clients --user-pool-id $userPoolId --query 'UserPoolClients[0].ClientId') )
    DEBUG echo $clientId
    playersRoleValue=$appName"PlayersRole"
    managersRoleValue=$appName"ManagersRole"
    roleMappings=$(cat <<-END
    {
        "$cognitoProviderName:$clientId": {
            "AmbiguousRoleResolution": "Deny",
            "Type": "Rules",
            "RulesConfiguration": {
                "Rules": [
                    {
                        "Claim": "cognito:preferred_role",
                        "MatchType": "Contains",
                        "RoleARN": "$playersRoleArn",
                        "Value": "$playersRoleValue"
                    },
                    {
                        "Claim": "cognito:preferred_role",
                        "MatchType": "Contains",
                        "RoleARN": "$managersRoleArn",
                        "Value": "$managersRoleValue"
                    }
                ]
            }
        }
    }
END
    )

    setIdentityPoolRoles=$(cat <<-END
    aws cognito-identity set-identity-pool-roles \
    --identity-pool-id $identityPoolId 
    --roles authenticated="$playersRoleArn",unauthenticated="$unauthRoleArn" \
    --role-mappings '$roleMappings'
END
)
    DEBUG echo $setIdentityPoolRoles
    eval $setIdentityPoolRoles
}

function deploy() {
    echo Starting DEPLOYING 
    date
    echo DEPLOYING environment 
    echo envName: $1 
    echo suffix:  $2
    cdk deploy -c envname=$1 -c suffix=$2
    echo Finishing DEPLOYING 
    date
}

### --------------------------------------------
### FUNCTION INSTALL
### Installs the application on the S3 bucket
### --------------------------------------------
function install() {
    envname=$1
    suffix=$2
    appname=$(echo $envname$suffix | tr '[A-Z]' '[a-z]')
    echo Installing the application
    
    tempfolder="./output/tempapp"
    if [[ ! -e $tempfolder ]]; then
          mkdir $tempfolder
    else
          rm -rf $tempfolder
          mkdir $tempfolder
    fi

    echo Downloading the code...
    ###git clone https://fabianmartins@bitbucket.org/fabianmartins/awsspaceinvaders.git $tempfolder
    aws s3 cp s3://aws.spaceinvaders.ninja/ $tempfolder --recursive
  
    echo Updating the configuration file for the game...
    region=$(aws configure get region)
    getApiId=$(echo "aws apigateway get-rest-apis --query 'items[?name==\`"$appname"\`]|[0].id'")
    apiId=$( removeQuotes $( eval $getApiId ) )
    apiEndpoint="https://"$apiId".execute-api."$region".amazonaws.com/prod/v1/"
    ## the folder structure '$folder/resources/js/' MUST exist
    cat > $tempfolder/resources/js/awsconfig.js <<-EOF
const DEBUG = true;
const AWS_CONFIG = {
    "region" : "$region",
    "API_ENDPOINT" : "$apiEndpoint"
}
EOF

    echo Copying it to the application bucket
    aws s3 cp $tempfolder  s3://$appname.app --recursive --only-show-errors

    echo Deleting the temporary folder
    # rm -rf $tempfolder
}


function clearAppBucket() {
    appBucketname=$(echo $1.app | tr '[A-Z]' '[a-z]')
    echo --- Deleting APP Bucket
    echo Deleting content at $appBucketname
    aws s3 rm s3://$appBucketname --recursive

    #echo Deleting bucket $appBucketname
    #aws s3 rb s3://$appBucketname
    #rawBucketname=$(echo $envName$suffix.raw | tr '[A-Z]' '[a-z]')
    #echo --- Deleting RAW Bucket
    #echo Deleting content at $rawBucketname
    #aws s3 rm s3://$rawBucketname --recursive
    #echo Deleting bucket $rawBucketname
    #aws s3 rb s3://$appBucketname
}

function destroy() {
    echo Starting DESTROYING 
    date
    echo DESTROYING environment 
    echo envname: $1 
    echo suffix:  $2
    appname=$(echo $1$2 | tr '[A-Z]' '[a-z]')
    appbucketname="$appname.app"
    echo Deleting content at $appbucketname
    aws s3 rm s3://$appbucketname --recursive
    cdk destroy -c envname=$1 -c suffix=$2
    echo Finishing DESTROYING 
    date
}

function test() {
    #echo "NOTHING TO TEST"
    setRoleMappings $1 $2
}

command=$(echo $1 | tr 'a-z' 'A-Z')
if [[ "$command" == "" || "$command" == "HELP" ]]; then 
    help
else 
    read -p "What's the name for the environment?  [defaults to NRTA]: " envname
    read -p "What's the suffix you want to use? [defaults to nothing]: " suffix
    if [ "$envname" == "" ]; then
        envname="NRTA"
    fi
    if [ "$command" == "DEPLOYFULL" ]; then
        deploy $envname $suffix
        # Executing set-identity-pool-roles on IdentityPool: $identityPoolId ...
        # this is pending to be solved on CDK 
        setRoleMappings $envname $suffix
    if [ "$command" == "DEPLOY" ]; then
        deploy $envname $suffix
    elif [ "$command" == "DESTROY" ]; then
        destroy $envname $suffix
    elif [ "$command" == "SETROLEMAPPINGS" ]; then
        setRoleMappings $envname $suffix
    elif [ "$command" == "TEST" ]; then
        test $envname $suffix
    elif [ "$command" == "INSTALL" ]; then
        install $envname $suffix
    else
        help
    fi
fi