#!/bin/bash
##
# Automatically creates the environment name
##
setColor=$(tput setaf 3) # Green
resetColor=$(tput sgr0) # Text reset
echo "**************************************************************"
echo "DEFINING YOUR EXCLUSIVE ENVIRONMENT NAME"
echo ""
echo "When we define the exclusive environment name all resources"
echo "in your infrastructure will have their IDs prefixed by this"
echo "environment name."
echo "This is a workaround to guarantee that this workshop can run"
echo "with multiple users under a single AWS account"
echo "**************************************************************"
echo
read -p "What are your initials? " initials
initials=$(echo $initials | tr -cd "[a-zA-Z0-9]\n" | tr 'A-Z' 'a-z'  )

### Generating a random 6 hexadecimal digit code, like a0b1c2
randomcode=$(openssl rand -hex 3)
### Defining envname
envname=$(echo $initials"aaa"$randomcode | tr 'A-Z' 'a-z')
envnameuppercase=$(echo $envname | tr 'a-z' 'A-Z')
echo export envname=$envname >> ~/.bash_profile
echo "Your environment name was defined as"$setColor $envnameuppercase $resetColor