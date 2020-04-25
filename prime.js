SVGElement.prototype.getTransformToElement = SVGElement.prototype.getTransformToElement || function (toElement) {
  return toElement.getScreenCTM().inverse().multiply(this.getScreenCTM());
};

let nextUid = 0;
const svg = document.querySelector("#svg");
const diagramElement = document.querySelector("#diagram");
//console.log(svg);
//console.log(diagramElement);

const moduleLock = {};
const portLock = {};
const connectorLock = {};

const ports = [];
const modules = [];
const connectorList = [];

const dragProxy = document.querySelector("#drag-proxy"); 
const moduleElements = Array.from(document.querySelectorAll(".node-container"));
//console.log(dragProxy);
//console.log(moduleElements);


const frag = document.createDocumentFragment();
frag.appendChild(document.querySelector(".connector"));
//console.log(frag);

const connectorElement = frag.querySelector(".connector");
const connectorLayer = document.querySelector("#connections-layer");
//console.log(connectorElement);
//console.log(connectorLayer);
class Connector {

  constructor() {

    this.id = `connector_${nextUid++}`;
    this.dragType = "connector";
    this.isSelected = false;
    this.element = connectorElement.cloneNode(true);
    this.path = this.element.querySelector(".connector-path");
    this.pathOutline = this.element.querySelector(".connector-path-outline");
    this.inputHandle = this.element.querySelector(".input-handle");
    this.outputHandle = this.element.querySelector(".output-handle");
  }

  init(port) {
    //console.log("Tipo: "+port.portType)
    connectorLayer.appendChild(this.element);

    this.isInput = port.isInput;

    if (port.isInput) {
      this.inputPort = port;
      this.dragElement = this.outputHandle;
      this.staticElement = this.inputHandle;
    } else {
      this.outputPort = port;
      this.dragElement = this.inputHandle;
      this.staticElement = this.outputHandle;
    }

    this.staticPort = port;
    this.dragElement.setAttribute("data-drag", `${this.id}:connector`);
    this.staticElement.setAttribute("data-drag", `${port.id}:port`);

    TweenLite.set([this.inputHandle, this.outputHandle], {
      x: port.global.x,
      y: port.global.y });



  }

  updatePath() {

    const x1 = this.inputHandle._gsTransform.x;
    const y1 = this.inputHandle._gsTransform.y;

    const x4 = this.outputHandle._gsTransform.x;
    const y4 = this.outputHandle._gsTransform.y;

    const dx = Math.abs(x1 - x4);

    const p1x = x1;
    const p1y = y1;

    const p2x = x1 - dx;
    const p2y = y1;

    const p4x = x4;
    const p4y = y4;

    const p3x = x4 + dx;
    const p3y = y4;

    const data = `M${p1x} ${p1y} C ${p2x} ${p2y} ${p3x} ${p3y} ${p4x} ${p4y}`;

    this.path.setAttribute("d", data);
    this.pathOutline.setAttribute("d", data);
  }

  updateHandle(port) {

    if (port === this.inputPort) {

      TweenLite.set(this.inputHandle, {
        x: port.global.x,
        y: port.global.y });


    } else if (port === this.outputPort) {

      TweenLite.set(this.outputHandle, {
        x: port.global.x,
        y: port.global.y });

    }

    this.updatePath();
  }

  placeHandle() {
      const skipmodule = this.staticPort.parentNode.element;

      let hitPort;

      for (let module of modules) {

        if (module.element === skipmodule) {
          continue;
        }

        if (Draggable.hitTest(this.dragElement, module.element)) {

          const ports = this.isInput ? module.outputs : module.inputs;

          for (let port of ports) {

            if (Draggable.hitTest(this.dragElement, port.portElement)) {
              
              if(port.portType === this.staticPort.portType){

                hitPort = port;
                break;
              }else{
                alert("Port types are different -.-");
              }
              break;
            }
          }

          if (hitPort) {
            break;
          }
        }
      }

      if (hitPort) {

        if (this.isInput) {
          this.outputPort = hitPort;
        } else {
          this.inputPort = hitPort;
        }

        this.dragElement.setAttribute("data-drag", `${hitPort.id}:port`);

        hitPort.addConnector(this);
        this.updateHandle(hitPort);

      } else {
        this.remove();
      }

  }

  remove() {

    if (this.inputPort) {
      this.inputPort.removeConnector(this);
    }

    if (this.outputPort) {
      this.outputPort.removeConnector(this);
    }

    this.isSelected = false;

    this.path.removeAttribute("d");
    this.pathOutline.removeAttribute("d");
    this.dragElement.removeAttribute("data-drag");
    this.staticElement.removeAttribute("data-drag");

    this.staticPort = null;
    this.inputPort = null;
    this.outputPort = null;
    this.dragElement = null;
    this.staticElement = null;

    connectorLayer.removeChild(this.element);

    connectorList.push(this);

  }

  onDrag() {

    if(this.staticPort != null){
      this.updatePath();
    }
  }

  onDragEnd() {
    if(this.staticPort != null){
      this.placeHandle();
    }
  }}
class NodePort {

  constructor(parentNode, element, isInput) {

    this.portType=element.querySelector(".port-label").textContent;
    
    
    this.id = `port_${nextUid++}`;
    this.dragType = "port";

    this.parentNode = parentNode;
    this.isInput = isInput;

    this.element = element;
    this.portElement = element.querySelector(".port");
    this.portScrim = element.querySelector(".port-scrim");

    this.portScrim.setAttribute("data-drag", `${this.id}:port`);

    this.connectors = [];
    this.lastConnector;

    const bbox = this.portElement.getBBox();
    
    this.global = svg.createSVGPoint();
    this.center = svg.createSVGPoint();
    this.center.x = bbox.x + bbox.width / 2;
    this.center.y = bbox.y + bbox.height / 2;

    this.update();
  }

  createConnector() {

    let connector;

    if (connectorList.length) {
      connector = connectorList.pop();
      connectorLock[connector.id] = connector;
    } else {
      connector = new Connector();
    }

    connector.init(this);
    this.lastConnector = connector;
    this.connectors.push(connector);
  }

  removeConnector(connection) {

    const index = this.connectors.indexOf(connection);

    if (index > -1) {
      this.connectors.splice(index, 1);
    }
  }

  addConnector(connection) {
    this.connectors.push(connection);
  }

  update() {

    const transform = this.portElement.getTransformToElement(diagramElement);
    this.global = this.center.matrixTransform(transform);

    for (let connector of this.connectors) {
      connector.updateHandle(this);
    }
  }}
class NodeModule {

  constructor(element, x, y) {

    this.id = `module_${nextUid++}`;
    this.dragType = "module";
    this.name = "";
    this.functionId = "";
    element.setAttribute("data-drag", `${this.id}:module`);

    this.element = element;
    this.dragElement = element;

    TweenLite.set(element, { x, y });

    const inputElements = Array.from(element.querySelectorAll(".input-field"));
    const outputElements = Array.from(element.querySelectorAll(".output-field"));

    this.inputs = inputElements.map((element) => {
      const port = new NodePort(this, element, true);
      portLock[port.id] = port;
      ports.push(port);
      return port;
    });

    this.outputs = outputElements.map((element) => {
      const port = new NodePort(this, element, false);
      portLock[port.id] = port;
      ports.push(port);
      return port;
    });
  }

  onDrag() {

    for (let input of this.inputs) {
      input.update();
    }

    for (let output of this.outputs) {
      output.update();
    }
  }}   
class Chart {

  constructor() {

    this.dragElement = this.element = diagramElement;
    //console.log("moduleElements: "+moduleElements);
    moduleElements.forEach((element, i) => {
      const module = new NodeModule(element, 400 + i * 250, 50);
      moduleLock[module.id] = module;
      modules.push(module);
    });

    this.target = null;
    this.dragType = null;

    this.dragTarget = this.dragTarget.bind(this);
    this.prepareTarget = this.prepareTarget.bind(this);
    //console.log("prep");
    this.stopDragging = this.stopDragging.bind(this);

    this.draggable = new Draggable(dragProxy, {
      allowContextMenu: true,
      trigger: svg,
      onDrag: this.dragTarget,
      onDragEnd: this.stopDragging,
      onPress: this.prepareTarget });

  }

  stopDragging() {
    
    this.target.onDragEnd && this.target.onDragEnd();
  }


  
  prepareTarget(event) {
    //console.log("prepareTarget activated");
    let element = event.target;
    let drag;

    while (!(drag = element.getAttribute("data-drag")) && element !== svg) {
      if (window.CP.shouldStopExecution(0)){
        break;
      } 
      element = element.parentNode;
    }
    window.CP.exitedLoop(0);
    
    drag = drag || "diagram:diagram";
    const split = drag.split(":");
    const id = split[0];
    const dragType = split[1];
    
    
    switch (dragType) {
      case "diagram":
        this.target = this;
        break;

      case "module":
        this.target = moduleLock[id];
        break;

      case "port":
        //TODO ver se port tem connector.. se tiver podemos eliminar por aqui
        const port = portLock[id];
        //console.log(port);
        //console.log(port.connectors.length);
        if(port.connectors.length < 1){
          port.createConnector();
          this.target = port.lastConnector;
          this.dragType = this.target.dragType;
        
        }else{
          if(port.lastConnector){
            //console.log("maximo de cardinalidade alcancado");
            //console.log(port.lastConnector);
            port.lastConnector.remove();
          }
        
        }
       
        break;
     

      case "connector":
        this.target = connectorLock[id];
        break;}

  }

  dragTarget() {
    //console.log("target: "+this.target)
    //console.log("dragtype: "+this.target.dragType)

    if(this.target.dragType==="connector" && this.target.inputPort===null && this.target.outputPort===null){
      //console.log("in"+this.target.inputPort)
      //console.log("out"+this.target.outputPort)
      //console.log("hello there")
    }else{
      TweenLite.set(this.target.dragElement, {
        x: `+=${this.draggable.deltaX}`,
        y: `+=${this.draggable.deltaY}` });


      this.target.onDrag && this.target.onDrag();
    }

     
  }}

const chart = new Chart();

//JSON Part
function readTextFile(file, callback) {
  var rawFile = new XMLHttpRequest();
  rawFile.overrideMimeType("application/json");
  rawFile.open("GET", file, true);
  rawFile.onreadystatechange = function() {
      if (rawFile.readyState === 4 && rawFile.status == "200") {
          callback(rawFile.responseText);
      }
  }
  rawFile.send(null);
}

function createConnections(data){
    
  let counterModulos;
  for(counterModulos=0;counterModulos<data.Modules.length; counterModulos++){
  
    //criar ligacões entre modulos a partir do JSON
    let h;
    //se o moduo tem ligacoes que saiam dos seus inputs
    if(data.Modules[counterModulos].Connections.Inputs){
      for(h=0;h<data.Modules[counterModulos].Connections.Inputs.length; h++){
        console.log(data.Modules[counterModulos].Connections.Inputs);
        let ownInputPort = data.Modules[counterModulos].Connections.Inputs[h].InputPort;
        let outputModule = data.Modules[counterModulos].Connections.Inputs[h].ModuleID;
        let outputModulePort = data.Modules[counterModulos].Connections.Inputs[h].ModulePort;
        console.log("Own Input Port: " + ownInputPort);
        console.log("Module connected to this port " + outputModule);
        console.log("Port on that modules used: "+outputModulePort);
       
       
        let connector = new Connector();
        let InputPort = modules[counterModulos].inputs[ownInputPort];
        connector.init(InputPort);

        InputPort.lastConnector = connector;
        InputPort.connectors.push(connector);
        connector.updateHandle(InputPort);
        //place handle()
        let OutputPort = modules[outputModule].outputs[outputModulePort];
        console.log(OutputPort);
        
        OutputPort.addConnector(connector);
        
        connector.outputPort = OutputPort;
        connector.updateHandle(OutputPort);

        console.log("Connector: ");
        console.log(connector);


      }
    }


  }                                                                                                                                                    
};


readTextFile("foo.json", function(text){
  const data = JSON.parse(text);
  let counterModulos;
  for(counterModulos=0;counterModulos<data.Modules.length; counterModulos++){

    let n_inputs ;
    let n_outputs ;
    let maximo;

    //console.log(data.Modules[counterModulos].IO.Outputs);
    n_inputs = data.Modules[counterModulos].IO.Inputs.length;
    n_outputs = data.Modules[counterModulos].IO.Outputs.length;
    
    maximo = n_inputs >= n_outputs ?  n_inputs : n_outputs;
    let height = (maximo*14)+((maximo+1)*10);
    let novoModuloHTML ="";
    novoModuloHTML+='<g class="node-container"><rect class="node-background" width="204" height="128" x="0" y="0" rx="6" ry="6" /><g class="node-header"><rect class="header-round-rect" width="200" height="40" x="2" y="2" rx="4" ry="4" /><rect class="header-rect" width="200" height="36" x="2" y="6" /><text class="header-title" x="102" y="30">'+data.Modules[counterModulos].Name+'</text></g><g class="node-content"><rect class="content-round-rect" width="200" height="'+height+'" x="2" y="44" rx="4" ry="4" /><rect class="content-rect" width="200" height="77" x="2" y="44" /><g class="inputs">';
  
  
    let i;
    for(i=0;i<n_inputs; i++){
      //TODO ver ids para portos
      let portType = data.Modules[counterModulos].IO.Inputs[i].PortType;
      let transformValue = 50+(25*i);
      let novoInput = '<g class="input-field" transform="translate(0,'+transformValue+')"><g class="port"><circle class="port-outer" cx="15" cy="10" r="7.5" /><circle class="port-inner" cx="15" cy="10" r="5" /><circle class="port-scrim" cx="15" cy="10" r="7.5" /></g><text class="port-label" x="28" y="14">'+portType+'</text></g>';
      novoModuloHTML+=novoInput;
      //console.log(novoInput);
    }
    novoModuloHTML+="</g>";
    novoModuloHTML+='<g class="outputs">';
    
    let j;
    for(j=0;j<n_outputs; j++){
      //TODO ver ids para portos
      let portType = data.Modules[counterModulos].IO.Outputs[j].PortType;
      let transformValue = 50+(25*j);
      let novoOutput = '<g class="output-field" transform="translate(0,' +transformValue+')"><g class="port" data-clickable="false"><circle class="port-outer" cx="189" cy="10" r="7.5" /><circle class="port-inner" cx="189" cy="10" r="5" /><circle class="port-scrim" cx="189" cy="10" r="7.5" data-clickable="false" /></g><text class="port-label" x="176" y="14">'+portType+'</text></g>';
      novoModuloHTML+=novoOutput;
      //console.log(novoOutput);
    }
  
    novoModuloHTML+="</g> </g></g>";
  
    var divNova = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    divNova.setAttribute("class", "node-container");
  
  
    divNova.id = "ola";
    divNova.innerHTML = novoModuloHTML;
   
  
    let coordx=data.Modules[counterModulos].Coord.CoordX;
    let coordy=data.Modules[counterModulos].Coord.CoordY;
    document.getElementById("node-layer").appendChild(divNova);
    const module = new NodeModule(divNova,coordx, coordy);
    module.name = data.Modules[counterModulos].Name;
    moduleLock[module.id] = module;
    modules.push(module);




  }
  createConnections(data);



});


const app = require("electron").remote;
var dialog = app.dialog;
var fs = require("fs");

document.getElementById('save_project').onclick=() => {    
    //trying to get info from svg so later we can send through json
    //write a json file
    const writeJsonFile = require('write-json-file');


    var obj = {
      "title":"New Project Name",
      "Modules":[

      ]

    }
    let i;
    if(modules.length){
      for(i=0;i<modules.length;i++){
      let module_obj = {
        "Name":modules[i].name,
        "Coord":{
            "CoordX":modules[i].element.transform.baseVal[0].matrix.e.toString(),
            "CoordY":modules[i].element.transform.baseVal[0].matrix.f.toString()
        },
        "FunctionID":modules[i].functionId,
        "IO":{
          "Inputs":[

          ],
          "Outputs":[

          ]
        },
        "Connections":{
          "Inputs":[
          ]
        }
      }
      let j;
      for( j=0; j<modules[i].inputs.length; j++){
        let inputPortObj = {
          "PortID":j.toString(),
          "PortType":modules[i].inputs[j].portType
        }

        module_obj["IO"]["Inputs"].push(inputPortObj);

        
        
        let g;
        //alterar se a cardinalidade for para ser alterada

        if(modules[i].inputs[j].connectors.length>0){
          let ModuleIdOnModule=modules[i].inputs[j].connectors[0].outputPort.parentNode.id;
          let ModuleId;
          let ModulePort;

          //modulo -> corresponde ao modulo a qual a conexao vai ser feita
          //determinar o Id do modulo (corresponde à posicao do modulo no array)
          let temp;
          for(temp=0;temp<modules.length; temp++){
            if(modules[temp].id==ModuleIdOnModule){
              ModuleId=temp;
            }
          }
          
          //determinar o Id da porta do modulo (corresponde à posicao da porta no array)
          let temp2;
          for(temp2=0;temp2<modules[ModuleId].outputs.length; temp2++){
            if(modules[ModuleId].outputs[temp2].id==modules[i].inputs[j].connectors[0].outputPort.id){
              ModulePort= temp2;
            }
          }

          let connectionObj = {
                  "ModuleID":ModuleId.toString(),
                  "ModulePort":ModulePort.toString(),
                  "InputPort":j.toString()		
            }
          module_obj["Connections"]["Inputs"].push(connectionObj);
        }


      }

      let h;
      for(h=0; h<modules[i].outputs.length; h++){
        let outputPortObj = {
          "PortID":h.toString(),
          "PortType":modules[i].outputs[h].portType
        }
        module_obj["IO"]["Outputs"].push(outputPortObj);
      }

      obj["Modules"].push(module_obj);
    }

    console.log(obj);
    
    //var json = JSON.stringify(obj);
    //console.log(json);
    
    }
    
    (async () => {
        await writeJsonFile('foo.json', obj);
    })();
    
    
    
};



