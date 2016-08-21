//Copyright 2016 Sketchpunk Labs

//###########################################################################
//Main Static Object
//###########################################################################
var NEditor = {};
NEditor.dragMode = 0;
NEditor.dragItem = null;    //reference to the dragging item
NEditor.startPos = null;    //Used for starting position of dragging lines
NEditor.offsetX = 0;        //OffsetX for dragging nodes
NEditor.offsetY = 0;        //OffsetY for dragging nodes
NEditor.svg = null;         //SVG where the line paths are drawn.

NEditor.pathColor = "#999999";
NEditor.pathColorA = "#86d530";
NEditor.pathWidth = 2;
NEditor.pathDashArray = "20,5,5,5,5,5";

NEditor.init = function(){
	NEditor.svg = document.getElementById("connsvg");
	NEditor.svg.ns = NEditor.svg.namespaceURI;
};

/*--------------------------------------------------------
Global Function */

//Trail up the node nodes to get the X,Y position of an element
NEditor.getOffset = function(elm){
	var pos = {x:0,y:0};
	while(elm){
	  pos.x += elm.offsetLeft;
	  pos.y += elm.offsetTop;
	  elm = elm.offsetParent;
	}
	return pos;
};

//Gets the position of one of the connection points
NEditor.getConnPos = function(elm){
	var pos = NEditor.getOffset(elm);
	pos.x += (elm.offsetWidth / 2) + 1.5; //Add some offset so its centers on the element
	pos.y += (elm.offsetHeight / 2) + 0.5;
	return pos;
};

//Used to reset the svg path between two nodes
NEditor.updateConnPath = function(o){
	var pos1 = o.output.getPos(),
		pos2 = o.input.getPos();
	NEditor.setQCurveD(o.path,pos1.x,pos1.y,pos2.x,pos2.y);
};

//Creates an Quadratic Curve path in SVG
NEditor.createQCurve = function (x1, y1, x2, y2) {
	var elm = document.createElementNS(NEditor.svg.ns,"path");
	elm.setAttribute("fill", "none");
	elm.setAttribute("stroke", NEditor.pathColor);
	elm.setAttribute("stroke-width", NEditor.pathWidth);
	elm.setAttribute("stroke-dasharray", NEditor.pathDashArray);

	NEditor.setQCurveD(elm,x1,y1,x2,y2);
	return elm;
}

//This is seperated from the create so it can be reused as a way to update an existing path without duplicating code.
NEditor.setQCurveD = function(elm,x1,y1,x2,y2){
	var dif = Math.abs(x1-x2) / 1.5,
		str = "M" + x1 + "," + y1 + " C" +	//MoveTo
			(x1 + dif) + "," + y1 + " " +	//First Control Point
			(x2 - dif) + "," + y2 + " " +	//Second Control Point
			(x2) + "," + y2;				//End Point

	elm.setAttribute('d', str);
}

NEditor.setCurveColor = function(elm,isActive){ elm.setAttribute('stroke', (isActive)? NEditor.pathColorA : NEditor.pathColor); }

/*Unused function at the moment, it creates a straight line
NEditor.createline = function (x1, y1, x2, y2, color, w) {
	var line = document.createElementNS(NEditor.svg.ns, 'line');
	line.setAttribute('x1', x1);
	line.setAttribute('y1', y1);
	line.setAttribute('x2', x2);
	line.setAttribute('y2', y2);
	line.setAttribute('stroke', color);
	line.setAttribute('stroke-width', w);
	return line;
}*/


/*--------------------------------------------------------
Dragging Nodes */
NEditor.beginNodeDrag = function(n,x,y){
	if(NEditor.dragMode != 0) return;

	NEditor.dragMode = 1;
	NEditor.dragItem = n;
	this.offsetX = n.offsetLeft - x;
	this.offsetY = n.offsetTop - y;

	window.addEventListener("mousemove",NEditor.onNodeDragMouseMove);
	window.addEventListener("mouseup",NEditor.onNodeDragMouseUp);
};

NEditor.onNodeDragMouseUp = function(e){
	e.stopPropagation(); e.preventDefault();
	NEditor.dragItem = null;
	NEditor.dragMode = 0;

	window.removeEventListener("mousemove",NEditor.onNodeDragMouseMove);
	window.removeEventListener("mouseup",NEditor.onNodeDragMouseUp);
};

NEditor.onNodeDragMouseMove = function(e){
	e.stopPropagation(); e.preventDefault();
	if(NEditor.dragItem){
	  NEditor.dragItem.style.left = e.pageX + NEditor.offsetX + "px";
	  NEditor.dragItem.style.top = e.pageY + NEditor.offsetY + "px";
	  NEditor.dragItem.ref.updatePaths();
	}
};

/*--------------------------------------------------------
Dragging Paths */
NEditor.beginConnDrag = function(path){
	if(NEditor.dragMode != 0) return;

	NEditor.dragMode = 2;
	NEditor.dragItem = path;
	NEditor.startPos = path.output.getPos();

	NEditor.setCurveColor(path.path,false);
	window.addEventListener("click",NEditor.onConnDragClick);
	window.addEventListener("mousemove",NEditor.onConnDragMouseMove);
};

NEditor.endConnDrag = function(){
	NEditor.dragMode = 0;
	NEditor.dragItem = null;

	window.removeEventListener("click",NEditor.onConnDragClick);
	window.removeEventListener("mousemove",NEditor.onConnDragMouseMove);
}

NEditor.onConnDragClick = function(e){
	e.stopPropagation(); e.preventDefault();
	NEditor.dragItem.output.removePath(NEditor.dragItem);
	NEditor.endConnDrag();
};

NEditor.onConnDragMouseMove = function(e){
	e.stopPropagation(); e.preventDefault();
	if(NEditor.dragItem) NEditor.setQCurveD(NEditor.dragItem.path,NEditor.startPos.x,NEditor.startPos.y,e.pageX,e.pageY);
};

/*--------------------------------------------------------
Connection Event Handling */
NEditor.onOutputClick = function(e){
	e.stopPropagation(); e.preventDefault();
	var path = e.target.parentNode.ref.addPath();

	NEditor.beginConnDrag(path);
}

NEditor.onInputClick = function(e){
	e.stopPropagation(); e.preventDefault();
	var o = this.parentNode.ref;

	switch(NEditor.dragMode){
		case 2: //Path Drag
		  o.applyPath(NEditor.dragItem);
		  NEditor.endConnDrag();
		  
		  break;
		case 0: //Not in drag mode
		  var path = o.clearPath();
		  if(path != null) NEditor.beginConnDrag(path);
		  
		  o.node.autoOrganise();
		  break;
	}
}


//###########################################################################
// Connector Object
//###########################################################################

//Connector UI Object. Ideally this should be an abstract class as a base for an output and input class, but save time
//I wrote this object to handle both types. Its a bit hokey but if it becomes a problem I'll rewrite it in a better OOP way.
NEditor.Connector = function(node,isInput,name){
	this.node = node;
	this.name   = name;
	this.root   = document.createElement("li");
	this.dot    = document.createElement("i");
	this.label  = document.createElement("span");
	this.isInput = isInput;
	var pElm = this.node.eList;

	//Input/Output Specific values
	if(this.isInput) this.OutputConn = null;		//Input can only handle a single connection.
	else this.paths = [];    				//Outputs can connect to as many inputs is needed

	//Create Elements
	pElm.appendChild(this.root);
	this.root.appendChild(this.dot);
	this.root.appendChild(this.label);

	//Define the Elements
	this.root.className = (this.isInput)?"Input":"Output";
	this.root.ref = this;
	this.label.innerHTML = this.name;
	this.dot.innerHTML = "&nbsp;";

	this.dot.addEventListener("click", (this.isInput)?NEditor.onInputClick:NEditor.onOutputClick );
};



/*--------------------------------------------------------
Common Methods */

//Get the position of the connection ui element
NEditor.Connector.prototype.getPos = function(){ return NEditor.getConnPos(this.dot); }

//Just updates the UI if the connection is currently active
NEditor.Connector.prototype.resetState = function(){
	var isActive = (this.paths && this.paths.length > 0) || (this.OutputConn != null);

	if(isActive) this.root.classList.add("Active");
	else this.root.classList.remove("Active");
}

//Used mostly for dragging nodes, so this allows the paths to be redrawn
NEditor.Connector.prototype.updatePaths = function(){
	if(this.paths && this.paths.length > 0) for(var i=0; i < this.paths.length; i++) NEditor.updateConnPath(this.paths[i]);
	else if( this.OutputConn ) NEditor.updateConnPath(this.OutputConn);
}

//Used mostly for dragging nodes, so this allows the paths to be redrawn
NEditor.Connector.prototype.updateUI = function(){
	this.label.innerHTML = this.name;
	this.root.className = (this.isInput)?"Input":"Output";
	this.dot.innerHTML = "&nbsp;";
	this.resetState();
		
}

/*--------------------------------------------------------
Output Methods */

//This creates a new path between nodes
NEditor.Connector.prototype.addPath = function(){
	var pos = NEditor.getConnPos(this.dot),
		dat = {
			path: NEditor.createQCurve(pos.x,pos.y,pos.x,pos.y),
			input:null,
			output:this
		};

	NEditor.svg.appendChild(dat.path);
	this.paths.push(dat);
	return dat;
}

//Remove Path
NEditor.Connector.prototype.removePath = function(o){
	var i = this.paths.indexOf(o);

	if(i > -1){
		NEditor.svg.removeChild(o.path);
		this.paths.splice(i,1);
		this.resetState();
	}
}

NEditor.Connector.prototype.connectTo = function(o){
	if(o.OutputConn === undefined){
		console.log("connectTo - not an input");
		return;
	}

	var conn = this.addPath();
	o.applyPath(conn);
}

//removes connection.... although im not happy with this as it just removes from the ui
NEditor.Connector.prototype.removeSelf = function(){
	var pElm = this.node.eList;
	pElm.removeChild(this.root);
}

/*--------------------------------------------------------
Input Methods */

//Applying a connection from an output
NEditor.Connector.prototype.applyPath = function(o){
	//If a connection exists, disconnect it.
	if(this.OutputConn != null) this.OutputConn.output.removePath(this.OutputConn);
	
	//If moving a connection to here, tell previous input to clear itself.
	if(o.input != null) o.input.clearPath();



	o.input = this;			//Saving this connection as the input reference
	this.OutputConn = o;	//Saving the path reference to this object
	this.resetState();		//Update the state on both sides of the connection, TODO some kind of event handling scheme would work better maybe
	o.output.resetState();

	NEditor.updateConnPath(o);
	NEditor.setCurveColor(o.path,true);
	
	//start automation on adding new incoming connections
	if(this.node.Settings && this.node.Settings.AutoInputs != false  ){
		var conns = this.node.inputConnectors();
		if(conns.disconnected.length == 0){
			this.node.addInput( 
				//automatic naming done in the with a function defined at initalliaztion of the Node
				this.node.Settings.AutoInputs.name(this.node.Inputs) 
			);
		}
	}

}

//clearing the connection from an output
NEditor.Connector.prototype.clearPath = function(){
	if(this.OutputConn != null){
		var tmp = this.OutputConn;
		tmp.input = null;

		this.OutputConn = null;
		this.resetState();
		return tmp;
	}
}


//###########################################################################
// Node Object
//###########################################################################
NEditor.Node = function(sTitle, options){
	this.Title = sTitle;
	this.Inputs = [];
	this.Outputs = [];
	this.data = {};
	//adds settings :/ dunno the best way to mantain defaults
	this.options = {
		"AutoInputs" : options != undefined ? (options["AutoInputs"] || false) : false 
	}

	//.........................
	this.eRoot = document.createElement("div");
	document.body.appendChild(this.eRoot);
	this.eRoot.className = "NodeContainer";
	this.eRoot.ref = this;

	//.........................
	this.eHeader = document.createElement("header");
	this.eRoot.appendChild(this.eHeader);
	this.eHeader.innerHTML = this.Title;
	this.eHeader.addEventListener("mousedown",this.onHeaderDown);

	//.........................
	this.eList = document.createElement("ul");
	this.eRoot.appendChild(this.eList);
};

NEditor.Node.prototype.setData = function(data){
	this.data = data;
}

NEditor.Node.prototype.getData = function(data){
	return this.data;
}

//wanted a function to split up connections so when i automate adding new conns i can just check with
//node.inputConnectors().disconnected.length

NEditor.Node.prototype.inputConnectors = function(){
	var connectors = {"connected" : [],  "disconnected" : []};
	for(var i = 0;i < this.Inputs.length; i++){
		if(this.Inputs[i].OutputConn != null){
			connectors.connected.push(this.Inputs[i])
		} else { 
			connectors.disconnected.push(this.Inputs[i])
		}
	}
	return connectors;
}

//removes dead connections on autoInput Nodes 
//renames connections based on scheme
//adds a new blank connection to the end
NEditor.Node.prototype.autoOrganise = function(){
	if(!this.Settings || (!this.Settings.AutoInputs)  ){ 
		return this;
	}

	var keep = [];
	for(var i = 0;i < this.Inputs.length;i++){
		var conn = this.Inputs[i];
		
		if(conn.OutputConn == null){
			conn.removeSelf();
			
		} else {
			conn.name = this.Settings.AutoInputs.name(keep);
			conn.updateUI();
			keep.push(conn);
		}
	}

	this.Inputs = keep;
	
	this.addInput(
		this.Settings.AutoInputs.name(this.Inputs) 
	);

	this.updatePaths();
	return this;
}


NEditor.Node.prototype.addInput = function(name){ 
	var o = new NEditor.Connector(this,true,name) ;
	this.Inputs.push(o);
	return o;
}

NEditor.Node.prototype.addOutput = function(name){
	var o = new NEditor.Connector(this,false,name);
	this.Outputs.push(o);
	return o;
}

//finds and removes input based on name.... so atm im not checking but i think that names per node need to be unique
NEditor.Node.prototype.removeInput = function(name){ 
	for(var i = 0;i < this.Inputs.length;i++){
		var conn = this.Inputs[i];
		if(r.name == name){
			r.removeSelf();
		}
	}
}

NEditor.Node.prototype.removeOutput = function(name){
	// var o = new NEditor.Connector(this,false,name);
	// this.Outputs.push(o);
	// return o;
}

NEditor.Node.prototype.getInputPos = function(i){ return NEditor.getConnPos(this.Inputs[i].dot); }
NEditor.Node.prototype.getOutputPos = function(i){ return NEditor.getConnPos(this.Outputs[i].dot); }

NEditor.Node.prototype.updatePaths = function(){
	var i;
	for(i=0; i < this.Inputs.length; i++) this.Inputs[i].updatePaths();
	for(i=0; i < this.Outputs.length; i++) this.Outputs[i].updatePaths();
}

//Handle the start node dragging functionality
NEditor.Node.prototype.onHeaderDown = function(e){
	e.stopPropagation();
	NEditor.beginNodeDrag(e.target.parentNode,e.pageX,e.pageY);
};

NEditor.Node.prototype.setPosition = function(x,y){
	this.eRoot.style.left = x + "px";
	this.eRoot.style.top = y + "px";
};

NEditor.Node.prototype.setWidth = function(w){ this.eRoot.style.width = w+"px"; }


//###########################################################################
// SETUP
//###########################################################################
window.addEventListener("load",function(e){
	NEditor.init();
});
