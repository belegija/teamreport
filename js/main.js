// useful constants
const months_en_long = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const months_en = ["Jan","Feb","Mar","Apr","May","June","July","Aug","Sep","Oct","Nov","Dec"];

var promise_ = []; //global variable to store active promises

//Database initialization
var db = new Dexie("teamreport");

//db.delete(); // uncomment for not persistent database functionality

// Dexie database schema
db.version(1).stores({
    workers: '&id,name,onTeam,*onProjects',
    projects: '&id,name',
    teams: '&id,name',
    plans: '++id,idWorker,year,month,[idWorker+year+month]' // months are in range 0-11, just to be javascript Date.getMonth() compliant
});

// Debug and test data. Populates newly created database ( called only once per database lifetime)
// Real data should be pulled from backend
db.on("populate", function() {
    db.teams.add({id:1 , name: "team1"});
    db.teams.add({id:2 , name: "team2"});
    db.teams.add({id:3 , name: "team3"});
    db.projects.add({id:1 , name: "project1"});
    db.projects.add({id:2 , name: "project2"});
    db.projects.add({id:3 , name: "project3"});
    db.projects.add({id:4 , name: "project4"});
    db.projects.add({id:5 , name: "project5"});    
    db.workers.add({id: 1, name: "Worker1", onTeam: 1, onProjects: [1 , 2 , 3]});
    db.workers.add({id: 2, name: "Worker2", onTeam: 2, onProjects: [1 , 2 , 3]});
    db.workers.add({id: 3, name: "Worker3", onTeam: 1, onProjects: [5]});
    db.workers.add({id: 4, name: "Worker4", onTeam: 2, onProjects: [2,3,4 ,5]});
    db.workers.add({id: 5, name: "Worker5", onTeam: 1, onProjects: []});
    db.workers.add({id: 6, name: "Worker6", onTeam: 3, onProjects: [3]});
    db.workers.add({id: 7, name: "John Doe", onTeam: 1 , onProjects: [2,3,4 ,5]});
    db.workers.add({id: 8, name: "Max Musterman", onTeam: 1 , onProjects: [1,2,3,4 ,5]});
    db.plans.add({
        id: 1,
        idWorker: 1,
        year: 2017,
        month: 8 ,              
        week1: {
            available : 5,
            vacation : 0,
            assignedProjects : [{projectID:1 , days:2},{projectID:2 , days:1}]
        },
        week2 : {
            available : 5,
            vacation : 0,
            assignedProjects : [{projectID:1 , days:2},{projectID:2 , days:1}]
        },
        week3 : { available : 5 ,
                    vacation: 5
                },
        week4 : { available : 5 }            
        
        
    });
    db.plans.add({
        id: 2,
        idWorker: 1,
        year: 2017,
        month: 7 ,              
        week1 : {
            available : 5,
            vacation : 0,
            assignedProjects : [{projectID:1 , days:3},{projectID:2 , days:1}]
        },
        week2 : {
            available : 5,
            vacation : 3
        },
        week4 : {available : 5},        
        //week3  : {available : 1}
        
    });   
    db.plans.add({
        id: 10,
        idWorker: 1,
        year: 2015,
        month: 5 ,              
        week1 : {
            available : 5,
            vacation : 0,
            assignedProjects : [{projectID:1 , days:3},{projectID:2 , days:1}]
        },
        week2 : {
            available : 5,
            vacation : 5
        },
        week3 : {available : 5  },
        // week4 : {}, 
        week5 : {available : 0}
        
    });
});

db.open();

$(document).ready(function() {
    // Configure multiselect menus (teams, years)
    $("#selectTeamsMenu").multiselect({
            enableFiltering: true,
            filterBehaviour: "value",
            numberDisplayed: 1,
            nonSelectedText: "Select team(s)",
            allSelectedText: "All teams selected",
            nSelectedText: " teams selected"
    }); 
    $("#selectYear").multiselect();
        
    // Populate TEAMS SELECTION menu from database
    db.teams.toArray(function(teams){        
        for (let team of teams) {
            $("#selectTeamsMenu").append($("<option>").html(team.name).attr("value",team.id));            
        }        
        $("#selectTeamsMenu [value='1']").attr("selected","selected");
        $("#selectTeamsMenu").multiselect('rebuild');
        
    });
    
    // Populate YEARS SELECTION menu with current and next year, plus with years that are in database    
    db.plans.orderBy('year').uniqueKeys(function (years){
        let currentYear = new Date().getFullYear();
        let nextYear = new Date().getFullYear()+1;                
        years.sort(function(a, b){return b - a});
        if ($.inArray(nextYear,years,0) == -1) { //preventing duplicate entries
            $("#selectYear").append($("<option>").html(nextYear).attr("value",nextYear));
        }
        if ($.inArray(currentYear,years,0) == -1) { //preventing duplicate entries
            $("#selectYear").append($("<option>").html(currentYear).attr("value",currentYear));
        }
        for (let year of years) {
            $("#selectYear").append($("<option>").html(year).attr("value",year));
        }
        $("#selectYear [value='"+currentYear+"']").attr("selected","selected"); //select current year       
       $("#selectYear").multiselect('rebuild');
    });
    
    
    // register events
    $("#showReports").click(function () {
        if ($("#selectTeamsMenu").val() == null)  //.val() in JQuery version >=3.0 returns empty array instead of null when no option selected            
            alert("Please select at least one team");
        else {
            showTeams($("#selectTeamsMenu").val() , parseInt($("#selectYear").val())); //val() returns string type even if integer is in question            
        }
    });
    $("#btnModalSave").click(function (){
        saveWorker();
    });
});

