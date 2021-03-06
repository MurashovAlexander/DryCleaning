const express = require('express')
const sqliteJson = require('sqlite-json')
const md5 = require('js-md5');
const crypto = require('crypto')
const fs = require('fs');

const LOG_FILE = "logging.log";

const app = express()
const port = process.env.PORT || 80

const db = sqliteJson('DryCleaning.db3');

app.listen(port,
    (err) => {
        if (err) {
            return console.log('Error start server', err)
        }

        message = `Server is listening on ${port}\r\n`
        fs.appendFile(LOG_FILE, message, function (err) {
            if (err) return console.log(err);
            console.log(message)
          });
        
    })

app.post('/authorization', function (request, response) {
    var passportid = request.query.passportid
    var password = request.query.password

    if (passportid == null || password == null) {
        response.status(401).json({ message: '401 Unauthorized' })
    }
    else {
        var passwordMD5 = md5(password)

        db.json(`SELECT * FROM Employee WHERE PassportID = '${passportid}' AND Password = '${passwordMD5}'`, function (err, jsonString) {
            var json = JSON.parse(jsonString)
            if (json.length == 1) {
                var token = crypto.randomBytes(16).toString('hex');
                db.json(`DELETE FROM Token WHERE Employee = '${passportid}'`, function (err, jsonString) {
                    db.json(`INSERT INTO Token VALUES(${passportid}, '${md5(token)}')`, function (err, jsonString) {
                        response.status(200).json({ token: token })
                    });
                });
                message = `Success authorisation '${json[0].Name}'\r\n`
                fs.appendFile(LOG_FILE, message, function (err) {
                    if (err) return console.log(err);
                    console.log(message)
                  });
            }
            else {
                message = `Authorisation error for passport '${passportid}'\r\n`
                fs.appendFile(LOG_FILE, message, function (err) {
                    if (err) return console.log(err);
                    console.log(message)
                  });
                response.status(401).json({ message: '401 Unauthorized' })
            }
        });
    }
})

app.use((request, response, next) => {
    var token = request.headers.token

    if (token == null) {
        response.status(401).json({ message: '401 Unauthorized' })
    }
    else {
        db.json(`SELECT * FROM Token, Employee WHERE Token.Employee = Employee.PassportID AND Token.Token = '${md5(token)}'`, function (err, jsonString) {
            var json = JSON.parse(jsonString)
            if (json.length == 1) {

                message = `Request from '${json[0].Name}(${json[0].PassportID})' ${request.originalUrl}\r\n`
                fs.appendFile(LOG_FILE, message, function (err) {
                    if (err) return console.log(err);
                    console.log(message)
                  });

                // only authorization success next methods
                response.locals.passportid = json[0].Employee
                next()
            }
            else {
                response.status(401).json({ message: '401 Unauthorized' })
            }
        });
    }
})

app.get('/user', function (request, response) {
    db.json(`SELECT PassportID, Name, Role, IsAdmin FROM Employee WHERE PassportID = '${response.locals.passportid}'`, function (err, jsonString) {
        response.json(JSON.parse(jsonString)[0])
    });
});

app.put('/user', function (request, response) {
    var newPassportID = request.query.newPassportID == null ? "null" : `"${request.query.newPassportID}"`
    var newName = request.query.newName == null ? "null" : `"${request.query.newName}"`
    var newPassword = request.query.newPassword == null ? "null" : `"${md5(request.query.newPassword)}"`

    db.json(`UPDATE Employee
        SET
        PassportID = coalesce(${newPassportID}, PassportID),
        Name = coalesce(${newName}, Name),
        Password = coalesce(${newPassword}, Password)
        WHERE PassportID = '${response.locals.passportid}'`,
    function(err){
        if (err){
            response.status(500).json({ message: err.message })
        }
        else{
            db.json(`SELECT PassportID, Name, Role, IsAdmin FROM Employee WHERE PassportID = '${response.locals.passportid}'`, function (err, jsonString) {
                response.json(JSON.parse(jsonString)[0])
            });
        }
    });
});

app.post('/users', function (request, response) {
    db.json(`SELECT IsAdmin FROM Employee WHERE PassportID = '${response.locals.passportid}'`, function (err, jsonString) {
        var user = JSON.parse(jsonString)[0]
        if(user.IsAdmin)
        {
            if(request.query.newPassportID == null ||
                request.query.name == null ||
                request.query.role == null ||
                request.query.newPassword == null){
                    response.status(400).json({ message: "400 Bad Request" })
            }
            else{
                var isAdmin = request.query.isAdmin == null ? false : request.query.isAdmin
                db.json(`INSERT INTO Employee VALUES(
                    "${request.query.newPassportID}",
                    "${request.query.name}",
                    "${request.query.role}",
                    "${md5(request.query.newPassword)}",
                    ${isAdmin});`, function (err, jsonString) {
                        if (err){
                            response.status(500).json({ message: err.message })
                        }
                        else{
                            response.status(200).json({ message: "OK" })
                        }
                });
            }
        }
        else{
            response.status(403).json({ message: "403 Forbidden" })
        }
    });
});

app.delete('/users/:passportid', function (request, response) {
    db.json(`SELECT IsAdmin FROM Employee WHERE PassportID = '${response.locals.passportid}'`, function (err, jsonString) {
        var user = JSON.parse(jsonString)[0]
        if(user.IsAdmin || response.locals.passportid == request.params.passportid)
        {
            db.json(`DELETE FROM Employee WHERE PassportID = '${request.params.passportid}'`, function (err, jsonString) {
                if (err)
                {
                    response.status(500).json({ message: err.message })
                }
                else
                {
                    response.status(200).json({ message: "OK" })
                }
            });
        }
        else
        {
            response.status(403).json({ message: "403 Forbidden" })
        }
    });
});

app.put('/users/:passportid', function (request, response) {
    db.json(`SELECT IsAdmin FROM Employee WHERE PassportID = '${response.locals.passportid}'`, function (err, jsonString) {
        var user = JSON.parse(jsonString)[0]
        
        var newPassportID = request.query.newPassportID == null || request.query.newPassportID == '' ? "null" : `"${request.query.newPassportID}"`
        var newName = request.query.newName == null || request.query.newName == '' ? "null" : `"${request.query.newName}"`
        var newPassword = request.query.newPassword == null || request.query.newPassword == '' ? "null" : `"${md5(request.query.newPassword)}"`

        var newRole = "null" //only for admin
        var newIsAdmin = "null" //only for admin

        if(user.IsAdmin)
        {
            var newRole = request.query.newRole == null || request.query.newRole == '' ? "null" : `"${request.query.newRole}"`
            var newIsAdmin = request.query.newIsAdmin == null || request.query.newIsAdmin == '' ? "null" : (request.query.newIsAdmin.toLowerCase() === 'true')
        }

        if(!user.IsAdmin && request.params.passportid != response.locals.passportid) //query passport != current passport
        {
            response.status(403).json({ message: "Запрещено изменение не своего пользователя" })
        }
        else
        {
            var sqlQuery = `UPDATE Employee
                            SET
                            PassportID = coalesce(${newPassportID}, PassportID),
                            Name = coalesce(${newName}, Name),
                            Password = coalesce(${newPassword}, Password),
                            Role = coalesce(${newRole}, Role),
                            IsAdmin = coalesce(${newIsAdmin}, IsAdmin)
                            WHERE PassportID = '${request.params.passportid}'`
            db.json(sqlQuery,
                function(err){
                    if (err){
                        response.status(500).json({ message: err.message })
                    }
                    else{
                        db.json(`SELECT PassportID, Name, Role, IsAdmin FROM Employee WHERE PassportID = '${request.params.passportid}'`, function (err, jsonString) {
                            response.json(JSON.parse(jsonString)[0])
                        });
                    }
                });
        }
    });
});

app.get('/users', function (request, response) {
    db.json(`SELECT PassportID, Name, Role, IsAdmin FROM Employee`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.get('/users/:passportid', function (request, response) {
    db.json(`SELECT PassportID, Name, Role, IsAdmin FROM Employee WHERE PassportID = '${request.params.passportid}'`, function (err, jsonString) {
        response.json(JSON.parse(jsonString)[0])
    });
});

app.get('/materials', function (request, response) {
    db.json(`SELECT Name FROM Material`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.get('/materials/:name', function (request, response) {
    db.json(`SELECT Name FROM Material WHERE Name = '${request.params.name}'`, function (err, jsonString) {
        response.json(JSON.parse(jsonString)[0])
    });
});

app.post('/materials', function (request, response) {
    if(request.query.name == null){
            response.status(400).json({ message: "400 Bad Request" })
    }
    else{
        db.json(`INSERT INTO Material VALUES(
            "${request.query.name}");`, function (err, jsonString) {
                if (err){
                    response.status(500).json({ message: err.message })
                }
                else{
                    response.status(200).json({ message: "OK" })
                }
        });
    }
});

app.put('/materials/:name', function (request, response) {
    var name = request.query.name == null || request.query.name == '' ? "null" : `"${request.query.name}"`

    var sqlQuery = `UPDATE Material
                    SET
                    Name = coalesce(${name}, Name)
                    WHERE Name = '${request.params.name}'`
    db.json(sqlQuery,
        function(err){
            if (err){
                response.status(500).json({ message: err.message })
            }
            else{
                db.json(`SELECT * FROM Material WHERE Name = '${name}'`, function (err, jsonString) {
                    response.status(200).json({ message: "OK" })
                });
            }
        });
});

app.delete('/materials/:name', function (request, response) {
    db.json(`DELETE FROM Material WHERE Name = '${request.params.name}'`, function (err, jsonString) {
        if (err)
        {
            response.status(500).json({ message: err.message })
        }
        else
        {
            response.status(200).json({ message: "OK" })
        }
    });
});

app.get('/chemicalagents', function (request, response) {
    db.json(`SELECT Name FROM ChemicalAgent`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.post('/chemicalagents', function (request, response) {
    if(request.query.name == null){
            response.status(400).json({ message: "400 Bad Request" })
    }
    else{
        db.json(`INSERT INTO ChemicalAgent VALUES(
            "${request.query.name}");`, function (err, jsonString) {
                if (err){
                    response.status(500).json({ message: err.message })
                }
                else{
                    response.status(200).json({ message: "OK" })
                }
        });
    }
});

app.put('/chemicalagents/:name', function (request, response) {
    var name = request.query.name == null || request.query.name == '' ? "null" : `"${request.query.name}"`

    var sqlQuery = `UPDATE ChemicalAgent
                    SET
                    Name = coalesce(${name}, Name)
                    WHERE Name = '${request.params.name}'`
    db.json(sqlQuery,
        function(err){
            if (err){
                response.status(500).json({ message: err.message })
            }
            else{
                db.json(`SELECT * FROM ChemicalAgent WHERE Name = '${name}'`, function (err, jsonString) {
                    response.status(200).json({ message: "OK" })
                });
            }
        });
});

app.delete('/chemicalagents/:name', function (request, response) {
    db.json(`DELETE FROM ChemicalAgent WHERE Name = '${request.params.name}'`, function (err, jsonString) {
        if (err)
        {
            response.status(500).json({ message: err.message })
        }
        else
        {
            response.status(200).json({ message: "OK" })
        }
    });
});

app.get('/clients', function (request, response) {
    db.json(`SELECT * FROM Client`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.post('/clients', function (request, response) {
    if(request.query.name == null ||
        request.query.telephone == null){
            response.status(400).json({ message: "400 Bad Request" })
    }
    else{
        db.json(`INSERT INTO Client (Name, Telephone) VALUES(
            "${request.query.name}",
            "${request.query.telephone}");`, function (err, jsonString) {
                if (err){
                    response.status(500).json({ message: err.message })
                }
                else{
                    db.json(`SELECT seq FROM sqlite_sequence WHERE name = "Client"`, function (err, jsonString) {
                        var seq = JSON.parse(jsonString)[0].seq
                        db.json(`SELECT * FROM Client WHERE ID = '${seq}'`, function (err, jsonString) {
                            response.json(JSON.parse(jsonString)[0])
                        });
                    });
                }
        });
    }
});

app.get('/clients/:id', function (request, response) {
    db.json(`SELECT * FROM Client WHERE ID = '${request.params.id}'`, function (err, jsonString) {
        response.json(JSON.parse(jsonString)[0])
    });
});

app.put('/clients/:id', function (request, response) {
    var name = request.query.name == null || request.query.name == '' ? "null" : `"${request.query.name}"`
    var telephone = request.query.telephone == null || request.query.telephone == '' ? "null" : `"${request.query.telephone}"`

    var sqlQuery = `UPDATE Client
                    SET
                    Name = coalesce(${name}, Name),
                    Telephone = coalesce(${telephone}, Telephone)
                    WHERE ID = '${request.params.id}'`
    db.json(sqlQuery,
        function(err){
            if (err){
                response.status(500).json({ message: err.message })
            }
            else{
                db.json(`SELECT * FROM Client WHERE ID = '${request.params.id}'`, function (err, jsonString) {
                    response.json(JSON.parse(jsonString)[0])
                });
            }
        });
});

app.delete('/clients/:id', function (request, response) {
    db.json(`DELETE FROM Client WHERE ID = '${request.params.id}'`, function (err, jsonString) {
        if (err)
        {
            response.status(500).json({ message: err.message })
        }
        else
        {
            response.status(200).json({ message: "OK" })
        }
    });
});

app.get('/results', function (request, response) {
    db.json(`SELECT * FROM Result`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.post('/results', function (request, response) {
    if(request.query.name == null){
            response.status(400).json({ message: "400 Bad Request" })
    }
    else{
        db.json(`INSERT INTO Result VALUES(
            "${request.query.name}");`, function (err, jsonString) {
                if (err){
                    response.status(500).json({ message: err.message })
                }
                else{
                    response.status(200).json({ message: "OK" })
                }
        });
    }
});

app.put('/results/:name', function (request, response) {
    var name = request.query.name == null || request.query.name == '' ? "null" : `"${request.query.name}"`

    var sqlQuery = `UPDATE Result
                    SET
                    Name = coalesce(${name}, Name)
                    WHERE Name = '${request.params.name}'`
    db.json(sqlQuery,
        function(err){
            if (err){
                response.status(500).json({ message: err.message })
            }
            else{
                db.json(`SELECT * FROM Result WHERE Name = '${name}'`, function (err, jsonString) {
                    response.status(200).json({ message: "OK" })
                });
            }
        });
});

app.delete('/results/:name', function (request, response) {
    db.json(`DELETE FROM Result WHERE Name = '${request.params.name}'`, function (err, jsonString) {
        if (err)
        {
            response.status(500).json({ message: err.message })
        }
        else
        {
            response.status(200).json({ message: "OK" })
        }
    });
});

app.get('/roles', function (request, response) {
    db.json(`SELECT IsAdmin FROM Employee WHERE PassportID = '${response.locals.passportid}'`, function (err, jsonString) {
        var user = JSON.parse(jsonString)[0]
        var query = ``
        if(user.IsAdmin)
        {
            query = `SELECT Name, Salary FROM Role`
        }
        else{
            query = `SELECT Name, null FROM Role`
        }
        db.json(query, function (err, jsonString) {
            response.json(JSON.parse(jsonString))
        });
    });
});

app.post('/roles', function (request, response) {
    db.json(`SELECT IsAdmin FROM Employee WHERE PassportID = '${response.locals.passportid}'`, function (err, jsonString) {
        var user = JSON.parse(jsonString)[0]
        if(user.IsAdmin)
        {
            if(request.query.name == null ||
                request.query.salary == null){
                    response.status(400).json({ message: "400 Bad Request" })
            }
            else{
                db.json(`INSERT INTO Role VALUES(
                    "${request.query.name}",
                    "${request.query.salary}");`, function (err, jsonString) {
                        if (err){
                            response.status(500).json({ message: err.message })
                        }
                        else{
                            response.status(200).json({ message: "OK" })
                        }
                });
            }
        }
        else{
            response.status(403).json({ message: "403 Forbidden" })
        }
    });
});

app.put('/roles/:name', function (request, response) {
    db.json(`SELECT IsAdmin FROM Employee WHERE PassportID = '${response.locals.passportid}'`, function (err, jsonString) {
        var user = JSON.parse(jsonString)[0]
        if(user.IsAdmin)
        {
            var newName = request.query.newName == null || request.query.newName == '' ? "null" : `"${request.query.newName}"`
            var newSalary = request.query.newSalary == null || request.query.newSalary == '' ? "null" : `"${request.query.newSalary}"`
            
            var sqlQuery = `UPDATE Role
                SET
                Name = coalesce(${newName}, Name),
                Salary = coalesce(${newSalary}, Salary)
                WHERE Name = '${request.params.name}'`
            db.json(sqlQuery,
            function(err){
                if (err){
                    response.status(500).json({ message: err.message })
                }
                else{
                    response.status(200).json({ message: "OK" })
                }
            });
        }
        else
        {
            response.status(403).json({ message: "403 Forbidden" })
        }
    });
});

app.delete('/roles/:name', function (request, response) {
    db.json(`SELECT IsAdmin FROM Employee WHERE PassportID = '${response.locals.passportid}'`, function (err, jsonString) {
        var user = JSON.parse(jsonString)[0]
        if(user.IsAdmin)
        {
            db.json(`DELETE FROM Role WHERE Name = '${request.params.name}'`, function (err, jsonString) {
                if (err)
                {
                    response.status(500).json({ message: err.message })
                }
                else
                {
                    response.status(200).json({ message: "OK" })
                }
            });
        }
        else
        {
            response.status(403).json({ message: "403 Forbidden" })
        }
    });
});

app.get('/types', function (request, response) {
    db.json(`SELECT * FROM Type`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.put('/types/:name', function (request, response) {
    var name = request.query.name == null || request.query.name == '' ? "null" : `"${request.query.name}"`
    var compensation = request.query.compensation == null || request.query.compensation == '' ? "null" : `"${request.query.compensation}"`
    var cleaningprice = request.query.cleaningprice == null || request.query.cleaningprice == '' ? "null" : `"${request.query.cleaningprice}"`

    var sqlQuery = `UPDATE Type
                    SET
                    Name = coalesce(${name}, Name),
                    Compensation = coalesce(${compensation}, Compensation),
                    CleaningPrice = coalesce(${cleaningprice}, CleaningPrice)
                    WHERE Name = '${request.params.name}'`
    db.json(sqlQuery,
        function(err){
            if (err){
                response.status(500).json({ message: err.message })
            }
            else{
                response.status(200).json({ message: "OK" })
            }
        });
});

app.delete('/types/:name', function (request, response) {
    db.json(`DELETE FROM Type WHERE Name = '${request.params.name}'`, function (err, jsonString) {
        if (err)
        {
            response.status(500).json({ message: err.message })
        }
        else
        {
            response.status(200).json({ message: "OK" })
        }
    });
});

app.post('/types', function (request, response) {
        if(request.query.name == null ||
            request.query.compensation == null ||
            request.query.cleaningprice == null){
                response.status(400).json({ message: "400 Bad Request" })
        }
        else{
            db.json(`INSERT INTO Type VALUES(
                "${request.query.name}",
                "${request.query.compensation}",
                "${request.query.cleaningprice}");`, function (err, jsonString) {
                    if (err){
                        response.status(500).json({ message: err.message })
                    }
                    else{
                        response.status(200).json({ message: "OK" })
                    }
            });
        }
});

app.get('/cleaningsthings', function (request, response) {
    db.json(`SELECT * FROM CleaningThing`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.get('/cleaningsthings/:cleaningid', function (request, response) {
    db.json(`SELECT * from Thing t
            WHERE EXISTS(
                SELECT ThingID FROM CleaningThing c WHERE CleaningID = ${request.params.cleaningid}
                AND c.ThingID = t.ID
            )`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.post('/cleaningsthings', function (request, response) {
    if(request.query.cleaningid == null ||
        request.query.thingid == null){
            response.status(400).json({ message: "400 Bad Request" })
    }
    else{
        db.json(`INSERT INTO CleaningThing VALUES(
            "${request.query.cleaningid}",
            "${request.query.thingid}");`, function (err, jsonString) {
                if (err){
                    response.status(500).json({ message: err.message })
                }
                else{
                    response.status(200).json({ message: "OK" })
                }
        });
    }
});

app.put('/cleaningsthings/:cleaningid/:thingid', function (request, response) {
    var newcleaningid = request.query.newcleaningid == null || request.query.newcleaningid == '' ? "null" : `"${request.query.newcleaningid}"`
    var newthingid = request.query.newthingid == null || request.query.newthingid == '' ? "null" : `"${request.query.newthingid}"`
    var sqlQuery = `UPDATE CleaningThing
                    SET
                    CleaningID = coalesce(${newcleaningid}, CleaningID),
                    ThingID = coalesce(${newthingid}, ThingID)
                    WHERE CleaningID = '${request.params.cleaningid}'
                    AND ThingID = '${request.params.thingid}'`
    db.json(sqlQuery,
        function(err){
            if (err){
                response.status(500).json({ message: err.message })
            }
            else{
                response.status(200).json({ message: "OK" })
            }
        });
});

app.delete('/cleaningsthings/:cleaningid/:thingid', function (request, response) {
    db.json(`DELETE FROM CleaningThing WHERE CleaningID = '${request.params.cleaningid}' AND ThingID = '${request.params.thingid}'`, function (err, jsonString) {
        if (err)
        {
            response.status(500).json({ message: err.message })
        }
        else
        {
            response.status(200).json({ message: "OK" })
        }
    });
});

app.get('/cleanings', function (request, response) {
    db.json(`SELECT * FROM Cleaning`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.post('/cleanings', function (request, response) {
    if(request.query.date == null ||
        request.query.result == null ||
        request.query.employee == null ||
        request.query.chemicalagent == null){
            response.status(400).json({ message: "400 Bad Request" })
    }
    else{
        db.json(`INSERT INTO Cleaning (Date, Result, Employee, ChemicAlagent) VALUES(
            "${request.query.date}",
            "${request.query.result}",
            "${request.query.employee}",
            "${request.query.chemicalagent}");`, function (err, jsonString) {
                if (err){
                    response.status(500).json({ message: err.message })
                }
                else{
                    db.json(`SELECT seq FROM sqlite_sequence WHERE name = "Cleaning"`, function (err, jsonString) {
                        var seq = JSON.parse(jsonString)[0].seq
                        db.json(`SELECT * FROM Cleaning WHERE ID = '${seq}'`, function (err, jsonString) {
                            response.json(JSON.parse(jsonString)[0])
                        });
                    });
                }
        });
    }
});

app.get('/cleanings/:id', function (request, response) {
    db.json(`SELECT * FROM Cleaning WHERE ID = '${request.params.id}'`, function (err, jsonString) {
        response.json(JSON.parse(jsonString)[0])
    });
});

app.put('/cleanings/:id', function (request, response) {
    var date = request.query.date == null || request.query.date == '' ? "null" : `"${request.query.date}"`
    var result = request.query.result == null || request.query.result == '' ? "null" : `"${request.query.result}"`
    var employee = request.query.employee == null || request.query.employee == '' ? "null" : `"${request.query.employee}"`
    var chemicalagent = request.query.chemicalagent == null || request.query.chemicalagent == '' ? "null" : `"${request.query.chemicalagent}"`
    //var thing = request.query.thing == null || request.query.thing == '' ? "null" : `"${request.query.thing}"`

    var sqlQuery = `UPDATE Cleaning
                    SET
                    Date = coalesce(${date}, Date),
                    Result = coalesce(${result}, Result),
                    Employee = coalesce(${employee}, Employee),
                    ChemicalAgent = coalesce(${chemicalagent}, ChemicalAgent)
                    WHERE ID = '${request.params.id}'`
    db.json(sqlQuery,
        function(err){
            if (err){
                response.status(500).json({ message: err.message })
            }
            else{
                response.status(200).json({ message: "OK" })
            }
        });
});

app.delete('/cleanings/:id', function (request, response) {
    db.json(`DELETE FROM Cleaning WHERE ID = '${request.params.id}'`, function (err, jsonString) {
        if (err)
        {
            response.status(500).json({ message: err.message })
        }
        else
        {
            response.status(200).json({ message: "OK" })
        }
    });
});

app.get('/things', function (request, response) {
    db.json(`SELECT * FROM Thing`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.post('/things', function (request, response) {
    if(request.query.name == null ||
        request.query.material == null ||
        request.query.type == null ||
        request.query.cleaningorder == null){
            response.status(400).json({ message: "400 Bad Request" })
    }
    else{
        db.json(`INSERT INTO Thing (Name, Material, Type, CleaningOrder) VALUES(
            "${request.query.name}",
            "${request.query.material}",
            "${request.query.type}",
            "${request.query.cleaningorder}");`, function (err, jsonString) {
                if (err){
                    response.status(500).json({ message: err.message })
                }
                else{
                    db.json(`SELECT seq FROM sqlite_sequence WHERE name = "Thing"`, function (err, jsonString) {
                        var seq = JSON.parse(jsonString)[0].seq
                        db.json(`SELECT * FROM Thing WHERE ID = '${seq}'`, function (err, jsonString) {
                            response.json(JSON.parse(jsonString)[0])
                        });
                    });
                }
        });
    }
});

app.get('/things/:id', function (request, response) {
    db.json(`SELECT * FROM Thing WHERE ID = '${request.params.id}'`, function (err, jsonString) {
        response.json(JSON.parse(jsonString)[0])
    });
});

app.put('/things/:id', function (request, response) {
    var name = request.query.name == null ? "null" : `"${request.query.name}"`
    var material = request.query.material == null ? "null" : `"${request.query.material}"`
    var type = request.query.type == null ? "null" : `"${request.query.type}"`
    var cleaningorder = request.query.cleaningorder == null ? "null" : `"${request.query.cleaningorder}"`

    db.json(`UPDATE Thing
        SET
        Name = coalesce(${name}, Name),
        Material = coalesce(${material}, Material),
        Type = coalesce(${type}, Type),
        CleaningOrder = coalesce(${cleaningorder}, CleaningOrder)
        WHERE ID = '${request.params.id}'`,
    function(err){
        if (err){
            response.status(500).json({ message: err.message })
        }
        else{
            db.json(`SELECT * FROM Thing WHERE ID = '${request.params.id}'`, function (err, jsonString) {
                response.json(JSON.parse(jsonString)[0])
            });
        }
    });
});

app.delete('/things/:id', function (request, response) {
    db.json(`DELETE FROM Thing WHERE ID = '${request.params.id}'`, function (err, jsonString) {
        if (err)
        {
            response.status(500).json({ message: err.message })
        }
        else
        {
            response.status(200).json({ message: "OK" })
        }
    });
});

app.get('/cleaningorders', function (request, response) {
    db.json(`SELECT * FROM CleaningOrder`, function (err, jsonString) {
        response.json(JSON.parse(jsonString))
    });
});

app.post('/cleaningorders', function (request, response) {
    if( request.query.dateofreceipt == null ||
        request.query.targetterm == null ||
        request.query.employee == null ||
        request.query.client == null){
            response.status(400).json({ message: "400 Bad Request" })
    }
    else{
        var DateOfReceipt = request.query.dateofreceipt
        //var DateOfReturn = request.query.dateofreturn //== null ? "null" : `${request.query.dateofreturn}`
        var TargetTerm = request.query.targetterm
        //var ActualTerm = request.query.actualterm //== null ? "null" : `${request.query.actualterm}`
        var Employee = request.query.employee
        var Client = request.query.client

        db.json(`INSERT INTO CleaningOrder (DateOfReceipt, TargetTerm, Employee, Client) VALUES(
            '${DateOfReceipt}',
            '${TargetTerm}',
            ${Employee},
            ${Client});`, function (err, jsonString) {
                if (err){
                    response.status(500).json({ message: err.message })
                }
                else{
                    db.json(`SELECT seq FROM sqlite_sequence WHERE name = "CleaningOrder"`, function (err, jsonString) {
                        var seq = JSON.parse(jsonString)[0].seq
                        db.json(`SELECT * FROM CleaningOrder WHERE ID = '${seq}'`, function (err, jsonString) {
                            response.json(JSON.parse(jsonString)[0])
                        });
                    });
                }
        });
    }
});

app.put('/cleaningorders/:id', function (request, response) {
    var DateOfReceipt = request.query.dateofreceipt == null ? "null" : `"${request.query.dateofreceipt}"`
    var DateOfReturn = request.query.dateofreturn == null ? "null" : `"${request.query.dateofreturn}"`
    var TargetTerm = request.query.targetterm == null ? "null" : `"${request.query.targetterm}"`
    var ActualTerm = request.query.actualterm == null ? "null" : `"${request.query.actualterm}"`
    var Employee = request.query.employee == null ? "null" : `${request.query.employee}`
    var Client = request.query.client == null ? "null" : `${request.query.client}`

    db.json(`UPDATE CleaningOrder
        SET
        DateOfReceipt = coalesce(${DateOfReceipt}, DateOfReceipt),
        DateOfReturn = coalesce(${DateOfReturn}, DateOfReturn),
        TargetTerm = coalesce(${TargetTerm}, TargetTerm),
        ActualTerm = coalesce(${ActualTerm}, ActualTerm),
        Employee = coalesce(${Employee}, Employee),
        Client = coalesce(${Client}, Client)
        WHERE ID = '${request.params.id}'`,
    function(err){
        if (err){
            response.status(500).json({ message: err.message })
        }
        else{
            db.json(`SELECT * FROM CleaningOrder WHERE ID = '${request.params.id}'`, function (err, jsonString) {
                response.json(JSON.parse(jsonString)[0])
            });
        }
    });
});

app.get('/cleaningorders/:id', function (request, response) {
    db.json(`SELECT * FROM CleaningOrder WHERE ID = '${request.params.id}'`, function (err, jsonString) {
        response.json(JSON.parse(jsonString)[0])
    });
});

app.delete('/cleaningorders/:id', function (request, response) {
    db.json(`DELETE FROM CleaningOrder WHERE ID = '${request.params.id}'`, function (err, jsonString) {
        if (err)
        {
            response.status(500).json({ message: err.message })
        }
        else
        {
            response.status(200).json({ message: "OK" })
        }
    });
});
