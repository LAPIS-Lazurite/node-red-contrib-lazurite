#node-red-lazurite

R/W data of Lazurite-Gateway.

#Install
-------
Run the following command:
    npm install node-red-contrib-lazurite

##requirement:
	hardware:	Raspberry Pi + Lazurite Pi Gateway
	Software:	LazDriver (Kernel driver)
				liblazurite (linux .so)
				also node-red

## install and setup
### 0. install required modules (if not installed)
git clone git://github.com/LAPIS-Lazurite/LazuriteInstaller
cd LazuriteInstaller
./install.sh

### 1. install node-red-lazurite
Execute following command.
npm install node-red-lazurite

then the node may be installed in "/home/pi/node_modules".

### 2. enabling node
edit "~/.node-red/setup.js"
modify parameter of nodesDir to enable "/home/pi/node_modules"

if there is not "~/.node-red/setup.js", start node-red. Then the file will be created.

## How to use
### start and stop node-red
 start node-red:   select "node-red" in menu bar. or input "node-red-start" on console.
 stop node-red:  input "node-red-stop" on console. 

When node is installed successfully, the nodes named "lazurite rx" and "lazurite tx" are appeared.
Please put the node and click it for detailes of parameters and usages.
