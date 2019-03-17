#!/bin/bash

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

if [ "$1" == "" ]; then
    echo ** ERROR**
    echo At least the environment name must be provided
    echo 
    echo Usage:
    echo fixcognito <envName>  [ <suffix> ]
else
    setRoleMappings $1 $2
fi