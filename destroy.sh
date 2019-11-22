#!/bin/bash
##
# Destroys all the elements created on the environment
##

txtgrn=$(tput setaf 2) # Green
txtylw=$(tput setaf 3) # Yellow
txtblu=$(tput setaf 4) # Blue
txtpur=$(tput setaf 5) # Purple
txtcyn=$(tput setaf 6) # Cyan
txtwht=$(tput setaf 7) # White
txtrst=$(tput sgr0) # Text reset

_DEBUG="on"


function EXECUTE() {
  [ "$_DEBUG" == "on" ] && echo $@ && $@  || $@
}


function title() {
    tput rev 
    showHeader $@
    tput sgr0
}

function showHeader() {
    input=$@
    echo ${txtgrn}
    printf "%0.s-" $(seq 1 ${#input})
    printf "\n"
    echo $input
    printf "%0.s-" $(seq 1 ${#input})
    echo ${txtrst}  
}

function showSectionTitle() {
    echo 
    echo ---  ${txtblu} $@ ${txtrst}  
    echo 
}

function destroyS3buckets() {
    showHeader "DESTROYING BUCKETS"
    envNameLowercase=$(echo $1 | tr 'A-Z' 'a-z' )
    deleteAppBucketCmd=$(echo "aws s3 rb s3://$envNameLowercase.app --force")
    EXECUTE $deleteAppBucketCmd
    echo "Bucket $envNameLowercase.app deleted."
    deleteRawBucketCmd=$(echo "aws s3 rb s3://$envNameLowercase.raw --force")
    EXECUTE $deleteRawBucketCmd
    echo "Bucket $envNameLowercase.raw deleted."
}

function destroyCDKEnvironment() {
    showHeader "CALLING CDK"
    _curDir=$PWD
    cd cdk
    envnameUppercase=$(echo $1 | tr 'a-z' 'A-Z')
    url=$(eval $(echo "aws cloudformation list-exports --query 'Exports[?contains(ExportingStackId,\`$envnameUppercase\`) && Name==\`url\`].Value | [0]' | xargs -I {} echo {}"))
    if [ "$url" == null ]; then
        EXECUTE "cdk destroy -c envname=$envnameUppercase"
    else
        EXECUTE "cdk destroy -c envname=$envnameUppercase -c deploycdn=true"
    fi
    cd $_curDir
}

function destroy() {
    title DESTROYING THE environment $1
    envname=$1
    envnameUppercase=$(echo $envname | tr 'a-z' 'A-Z')
    envnameLowercase=$(echo $envname | tr 'A-Z' 'a-z')
    echo The environment to be destroyed is ${txtylw}$1${txtrst}
    read -p ${txtylw}"Do you confirm (Y/N)? "${txtrst}  answer
    answer=$(echo ${answer:0:1} | tr 'a-z' 'A-Z')
    if [ $answer != Y ]; then
       echo 
       echo Exiting
       echo
    else
       read -p "Do you want the BUCKETS $envnameLowercase.app and$ $envnameLowercase.raw ${txtylw}to be deleted (Y/N)? "${txtrst} bucketAnswer
       echo ${txtylw}Beginning destruction...${txtrst} 
       bucketAnswer=$(echo ${bucketAnswer:0:1} | tr 'a-z' 'A-Z')
       destroyCDKEnvironment $envname
       if [ "$bucketAnswer" == "Y" ]; then
            destroyS3buckets $envname
       else
            echo "The buckets $envnameLowercase.app and $envnameLowercase.raw are still available"
       fi
    fi
}


if [ "$1" == "" ]; then
    echo 
    echo "** DESTROY script**"
    echo At least the environment name must be provided
    echo 
    echo Usage:
    echo "destroy <envName>"
    echo
    echo example: destroy testenv
else
    destroy $1
    title Finalizing
fi