/**
* After selecting team(s) and year, display the appropriate summary table(s)
* @param {Array} teamsID - Array of team IDs
* @param {integer} year - Year of report
*/
function showTeams(teamsID, year) {    
    $("#teamReports table").remove(); //remove existing tables before drawing again    
    // pull relevant data from database and draw table
    for (var teamID of teamsID) {        
        db.teams.get(parseInt(teamID)).then(function (team){
              db.workers.where('onTeam').equals(team.id).toArray(function (workers) {                
                drawTable(team,workers);
            }); 
        }) ;
        
                 
        // table has ID in form of table-teamName. 
        // worker cells for each month have attributes data-worker and data-month, former being worker id and latter month in 0-11 format
        function drawTable(team,workers) {            
            let promise_local = [];                       
            // draw table headers
            $("#teamReports").append($("<table>").attr("id","table-"+team.name).addClass("table table-bordered"));
            let tableId = "#table-"+team.name;
            $(tableId).html("<tr><th class='text-center' colspan=\"13\">"+team.name+" ("+year+")"+"</th></tr>" +
                    "<tr> <th>Name</th> <th>Jan</th> <th>Feb</th>  <th>Mar</th>  <th>Apr</th>" +
                    " <th>May</th> <th>Jun</th> <th>Jul</th> <th>Aug</th>  <th>Sep</th> "+
                    "  <th>Oct</th> <th>Nov</th> <th>Dec</th> </tr>"                      ); // add headers
            // draw worker names and DATA CELLS with percentage values
            for (let worker of workers) {         
                let wId = worker.id; // alternative to IIFE, when adding parameters to click event function                
                $(tableId).append($("<tr>").html("<td>"+worker.name+"</td>"));
                for (let i = 0; i <= 11; i++) {
                    $(tableId+" tr:last")
                            .append($("<td class='clickableCell' data-type='workerUtilization' data-worker='"+worker.id+"' data-month='"+i+"'>Fetching..</td>")
                                .click(function(){                                
                                    editWorker(wId,tableId,i,year);
                                })
                            );
                    promise_local.push(calcMonthParticipation(tableId,worker.id,i,year));  // monthly utilization in table is asynchronously populated. we must aggregate promises
                }      
            }
            $(".clickableCell").attr("role","button"); // pointer cursor over table cells
            $(".clickableCell").css("cursor","pointer"); 
            
            //draw total percentages in table footer                
            Promise.all(promise_local).then(function(){ // calculate total monthly utilization only when rest of the table is fully populated
                //ALL PROMISES EXECUTED succesfully. draw table footer                                
                let footer = "<th>Total:</th>";
                for (let i = 0; i <= 11; i++) {
                    footer+="<th data-type='teamUtilization' data-month='"+i+"'>"+calcTotalMonthParticipation(i,tableId)+"</th>";
                }
                $(tableId).append($("<tr>").html(footer));                   
            },function(){console.log("ERROR: PROMISE REJECTED")}); 
        }        
    }    
}

/**
* @param {number} workerId Database worker ID 
* @param {String} tableId Table ID attribute
* @param {number} month Month of report between 0-11
* @param {number} year Year of report
*/
function editWorker(workerId, tableId, month, year) {  
    db.workers.get(workerId).then(function (worker){
        db.projects.where('id').anyOf(worker.onProjects).toArray(function (projects) {                
            db.plans.where("[idWorker+year+month]").equals([workerId,year,month]).toArray(function(plan){                
                drawTable(worker,projects,plan);
            });
        }); 
    }) ;
    function drawTable(worker,projects,plan){ // all data cells are editable
        $("#editWorkerModal").modal("show");
        $('#editWorkerModal').on('hidden.bs.modal', function () {
            $("#editWorkerModal .text-warning").html("");            
        });
        $(".modal-body table").remove();    
        $(".modal-title").html(months_en_long[month]+" "+year+" ("+worker.name+")");
        let mondays = getMondaysInMonth(month,year);
        $(".modal-body").append($("<table>").attr("id","modal-table").addClass("table table-bordered"));$("table td").css("cursor:pointer");        
        // SAVE METADATA for CRUD
        if (plan.length > 0 ) {
            if (plan[0].hasOwnProperty("id")) {
                $("#modal-table").attr("data-planId",plan[0]["id"]); //save primary key if exists, otherwise ommit(autoincrement)
            }
            if (plan[0].hasOwnProperty("idWorker")) {
                $("#modal-table").attr("data-workerId",plan[0]["idWorker"]);
            } 
            if (plan[0].hasOwnProperty("month")) {
                $("#modal-table").attr("data-month",plan[0]["month"]);
            } 
            if (plan[0].hasOwnProperty("year")) {
                $("#modal-table").attr("data-year",plan[0]["year"]);
            }                
        } else {            
            $("#modal-table").attr("data-workerId",workerId);   
            $("#modal-table").attr("data-year",year);             
            $("#modal-table").attr("data-month",month);
        }
        $("#modal-table").attr("data-parentTableId",tableId);
        // TABLE HEADERS   
        $(".modal-body table").append($("<tr>").append("<th>Project(s)</th>"));
        for (let i = 0; i < mondays.length; i++) {
            $(".modal-body table tr:last").append("<th>"+mondays[i] +"</th>")
        }
        // AVAILABLE DAYS
        $(".modal-body table").append($("<tr>").append("<td>Available</td>"));
        for (let i = 1 ; i <= mondays.length;i++) {
            let daysValue = 0.0;
            let week = "week"+i;
            if (plan.length > 0 && plan[0].hasOwnProperty(week) && plan[0][week].hasOwnProperty("available")) {
                daysValue = plan[0][week]["available"];
            }
            $(".modal-body table tr:last").append("<td contenteditable='true' data-week='"+i+"' data-type='available' >"+parseFloat(daysValue).toFixed(1)+"</td>");
        }
        // PROJECT ASSIGNMENTS
        for (let project of projects) {                     
            $(".modal-body table").append($("<tr>").html("<td data-type='projectName'>"+project.name+"</td>"));
            for (let i = 1; i <= mondays.length; i++) {
                let daysValue = 0.0;
                let week = "week"+i;                
                if (plan.length > 0 && plan[0].hasOwnProperty(week) && plan[0][week].hasOwnProperty("assignedProjects")) {
                    let assignedProjects = plan[0][week]["assignedProjects"];
                    for (let assignedProject of assignedProjects) { 
                        if (project.id == assignedProject["projectID"]) 
                            daysValue = assignedProject["days"];
                    }
                }                
                $(".modal-body table tr:last")
                        .append($("<td contenteditable='true' data-type='projectAssignments' class='editableCell' data-projectId='"+project.id+"' data-week='"+i+"'>" + parseFloat(daysValue).toFixed(1) + "</td>"));                                        
            }      
        }
        // VACATION DAYS       
        $(".modal-body table").append($("<tr>").append("<td>Vacation</td>"));
        for (let i = 1 ; i <= mondays.length;i++) {
            let daysValue = 0.0;
            let week = "week"+i;
            if (plan.length > 0 && plan[0].hasOwnProperty(week) && plan[0][week].hasOwnProperty("vacation")) {
                daysValue = plan[0][week]["vacation"];
            }
            $(".modal-body table tr:last").append("<td contenteditable='true' data-week='"+i+"' data-type='vacation'>"+parseFloat(daysValue).toFixed(1)+"</td>");
        }
        // WEEKLY UTILIZATION
        let footer = "<th>Utilization:</th>";
        for (let i = 1; i <= mondays.length; i++) {
            footer+="<th data-type='utilization' data-week='"+ i + "'>"+calcWeekUtilization(i)+"</th>";
        }
        $(".modal-body table").append($("<tr>").html(footer));
        
        function calcWeekUtilization(week) {
            var available = parseFloat($("#editWorkerModal" + " td[data-week='"+week+"'][data-type='available']").text());
            if (available == 0.0 ) { // no utilization if worker not available
                return "-";
            }    
            var sumProjects = 0.0;
            $("#editWorkerModal" + " td[data-week='"+week+"'][data-type='projectAssignments']").each(function(){        
                if ( parseFloat($(this).text()) ) {
                    sumProjects += parseFloat($(this).text());
                }
            });    

            var vacation = parseFloat($("#editWorkerModal" + " td[data-week='"+week+"'][data-type='vacation']").text());            
            return ((sumProjects + vacation)*100/available).toFixed(1) + "%";
    
        }
    }
}

/**
 * Saves worker data from modal window to database.
 */
function saveWorker() {
    // INPUT VALIDATION
    if (!validateWorkerInput()){
        $("#editWorkerModal .text-warning").html("Only numbers are allowed");
        return;
    }
    // PREPARE OBJECT FOR INSERT
    var dataWorker = {};
    if ($("#modal-table").attr("data-planId") != undefined) {
        dataWorker["id"] = parseInt($("#modal-table").attr("data-planId"));
    }
    dataWorker["idWorker"] = parseInt($("#modal-table").attr("data-workerId"));
    dataWorker["month"] = parseInt($("#modal-table").attr("data-month"));
    dataWorker["year"] = parseInt($("#modal-table").attr("data-year"));
    let month = dataWorker["month"];
    let year = dataWorker["year"];
    let workerId = dataWorker["idWorker"];
    let mondays = getMondaysInMonth(month,year);
    for (let i = 1 ; i <= mondays.length; i++) {
        dataWorker["week"+i] = {};
        dataWorker["week"+i]["available"] = parseFloat($("#modal-table" +" [data-week='"+i+"'][data-type='available']").text());
        dataWorker["week"+i]["vacation"] = parseFloat($("#modal-table" +" [data-week='"+i+"'][data-type='vacation']").text());
        dataWorker["week"+i]["assignedProjects"] = [];        
        $("#modal-table td[data-week='"+i+"'][data-type='projectAssignments']").each(function(){                
            dataWorker["week"+i]["assignedProjects"].push({projectID:$(this).attr("data-projectId"),days: parseFloat($(this).text())});                                
        });
    }    
    db.plans.put(dataWorker).then(function(result){
        let parentTableId = $("#modal-table").attr("data-parentTableId");
        calcMonthParticipation(parentTableId,workerId, month, year).then(function (){
            let result = calcTotalMonthParticipation(month,parentTableId); 
            $(parentTableId + " th[data-type='teamUtilization'][data-month='"+month+"']").text(result);
        });
        $("#editWorkerModal").modal("hide");
        $(".modal-body table").remove();       
    });
    
}


/**
 * calculate monthly utilization for given cell(worker)
 * @param {String} tableId Table ID attribute
 * @param {number} workerId Database worker ID 
 * @param {number} month Month of report between 0-11
 * @param {number} year Year of report
 */
function calcMonthParticipation (tableId,workerId, month, year) {        
    return db.plans.where("[idWorker+year+month]").equals([workerId,year,month]).toArray(function(plan) {
        let activeWeeks = 0.0;
        let totalUtilization = 0.0;
        for (let i = 1; i <= 5 ; i++) { // extract data from all 5 possible weeks in a given month from database. 
            let week = "week"+i;
            if (plan.length > 0 && 
                    plan[0].hasOwnProperty(week) &&
                    plan[0][week].hasOwnProperty("available") &&
                    plan[0][week]["available"] > 0
                    ) { // week counts towards utilization only if worker available in the first place
                activeWeeks += 1;                
                let weekUtilization = 0;                
                if (plan[0][week].hasOwnProperty("vacation")) { // add vacation days
                    weekUtilization += plan[0][week]["vacation"];
                }
                if (plan[0][week].hasOwnProperty("assignedProjects")) { // add days assigned to projects 
                    let assignedProjects = plan[0][week]["assignedProjects"];
                    for (let assignedProject of assignedProjects) {                    
                        weekUtilization += assignedProject["days"];
                    }
                }
                weekUtilization = weekUtilization/plan[0][week]["available"]; 
                totalUtilization += weekUtilization;            
            }
        }
        if ( activeWeeks != 0 ) $(tableId+" [data-worker='"+workerId+"'][data-month='"+month+"']").html((totalUtilization/activeWeeks*100).toFixed(1)+"%");
        else $(tableId+" [data-worker='"+workerId+"'][data-month='"+month+"']").html("-");
    });
}

/**
 * calculate total monthly utiliziation for a given month in team
 * @param {number} month Month of report between 0-11
 * @param {String} tableId Table ID attribute
 * @returns {String} Percentage for total utilization
 */
function calcTotalMonthParticipation (month,tableId) {    
    var sum = -1.0;
    var activeWorkers = 0;
    $(tableId + " td[data-month='"+month+"'][data-type='workerUtilization']").each(function(){        
        if (!isNaN( parseFloat($(this).text() ))) {
            sum += parseFloat($(this).text());
            activeWorkers+=1;
        }
    });    
    if (sum == -1.0) { //not a single value in column was number
        return "-";
    } else {         
        return ((sum+1)/parseFloat(activeWorkers)).toFixed(1)+"%"; 
    }
}

/**
 * Validates the input in edit worker modal window
 * @returns {Boolean} True if input is ok, false otherwise
 */
function validateWorkerInput () {
    // check if given input is appropriate (project participation must be less or equal than availability for that week, etc-)
    let valid = true;
    $("#editWorkerModal [contenteditable='true']").each(function(){        
        if (isNaN(parseFloat($(this).text())))
            valid = false;
    });
    return valid;
}

/**
 * Calculates all mondays for a given month in a year.
 * @param {number} month Month between 0-11
 * @param {number} year
 * @returns {Array} Array containing all first mondays of a month in this format "DD.MM."
 */
function getMondaysInMonth(month,year) {    
    var date = new Date();
    date.setFullYear(year);
    date.setMonth(month);            
    var daysInMonth = 32 - new Date(year, month, 32).getDate(); //overflow to next month in order to find number of days in previous month
    var mondaysInMonth = [];
    for ( let i = 1 ; i <= daysInMonth ; i++) {
        date.setDate(i);
        if (date.getDay() == 1) {
            // it is Monday
            mondaysInMonth.push(date.getDate()+"."+(date.getMonth()+1)+".");
        }
    }  
    return mondaysInMonth;
}
