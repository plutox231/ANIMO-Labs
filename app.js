//npm i express express-handlebars body-parser mongodb mongoose jquery
//npm install multer
//npm install bcrypt

const express = require('express');
const server = express();

const bodyParser = require('body-parser');
server.use(express.json()); 
server.use(express.urlencoded({ extended: true }));

const handlebars = require('express-handlebars');
server.set('view engine', 'hbs');
server.engine('hbs', handlebars.engine({
    extname: 'hbs',
}));

server.use(express.static('public'));

const responder = require('./models/responder');
const bcrypt = require('bcrypt');

const multer = require('multer');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
      cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
      cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });


server.get('/', function(req, resp){
  resp.render('login',{
      layout: 'index',
      title: 'Login Page',
      style: '/common/login-style.css',
      isInvalid: 0
  });
});

let current_user = {name: "", id: 0, type: "", desc: ""};

server.post('/login', (req, res) => {
  const { user_id, password } = req.body;
  console.log(user_id, password);
  responder.userModel.findOne({ user_id, password })
      .then(user => {
          if (!user) {
              res.render('login', { 
                layout: 'index',
                title: 'Login Page',
                style: '/common/login-style.css',
                isInvalid: 1 });
          } else {
              current_user.name = user.name;
              current_user.id = user.user_id; 
              current_user.type = user.acc_type; 
              current_user.desc = user.desc; 
              if (user.acc_type === 'student') {
                  res.redirect('/user-profile/' + user_id);
                  
              } else if (user.acc_type === 'lab-administrator') {
                  res.redirect('/lab-profile/' + user_id);
              }
          }
      })
      .catch(err => {
          console.error(err);
          res.status(500).send('Server error');
      });
});

server.get('/sign-up', function(req, resp){
  resp.render('sign-up',{
      layout: 'index',
      title: 'Sign Up',
      style: '/common/signup-style.css'
  });
});

server.get('/user-profile/:id/', function(req, resp){
  const searchQuery = { student_id: req.params.id }; 
  
  // Fetch user data
  const userPromise = responder.userModel.find(searchQuery).lean();
    
  // Fetch reservation data
  const reservationPromise = responder.reservationModel.find(searchQuery).lean();
  const searchTech = {acc_type: "lab-administrator"};
  const techPromise = responder.userModel.find(searchTech).lean();
  // Wait for both promises to resolve
  Promise.all([userPromise, reservationPromise, techPromise])
      .then(function([user_data, reservation_data, tech_data]){
        
        const lab = [...new Set(reservation_data.map(reservation => reservation.laboratory))];
        const startTime = [...new Set(reservation_data.map(reservation => reservation.start_time))];
        const endTime = [...new Set(reservation_data.map(reservation => reservation.end_time))];
        const studentID = [...new Set(reservation_data.map(reservation => reservation.student_id))];

        console.log(studentID);
        console.log(current_user.name);
        resp.render('user-profile',{
            layout: 'user-index',
            title: 'User Profile',
            style: '/common/user-style.css',
            script: '/common/user-profile.js',
            currentUser: current_user,
            reservationData: reservation_data,
            techUsers: tech_data,
            studentID: studentID,
            lab: lab, 
            startTime: startTime, 
            endTime: endTime, 
        });
      })
      .catch(responder.errorFn());
});

server.post('/view-filter-user', function(req, res) { 
  const student_id = req.body.student_id;
  const lab = req.body.laboratory;
  const start = req.body.start_time;
  const end = req.body.end_time;

  console.log(student_id);
  
  const searchQuery = { student_id: student_id };
  if (lab) {
      searchQuery.laboratory = lab;
  }
  if (start) {
      searchQuery.start_time = start;
  }
  if (end) {
    searchQuery.end_time = end;
  }
  console.log(searchQuery);
  // Find reservations based on the constructed query
  responder.reservationModel.find(searchQuery).lean().then(function(filteredData) {
      // Send back the filtered data as JSON response
      res.json(filteredData);
  }).catch(function(err) {
      // Handle errors appropriately
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
  });
});

server.get('/lab-profile/:id/', function(req, resp){
  const searchQuery = {};
  const searchStudent = {acc_type: "student"};
  const studentPromise = responder.userModel.find(searchStudent).lean();
  const reservationPromise = responder.reservationModel.find(searchQuery).lean();

  Promise.all([reservationPromise, studentPromise])
  .then(function([reservation_data, student_data]){
    const lab = [...new Set(reservation_data.map(reservation => reservation.laboratory))];
    const startTime = [...new Set(reservation_data.map(reservation => reservation.start_time))];
    const endTime = [...new Set(reservation_data.map(reservation => reservation.end_time))];
      
    resp.render('lab-profile', {
      layout: 'user-index',
      title: 'Lab Profile',
      style: '/common/lab-style.css',
      script: '/common/lab-profile.js',
      currentUser: current_user,
      upcomingReservations: reservation_data,
      studentUsers: student_data,
      lab: lab, 
      startTime: startTime, 
      endTime: endTime, 
      viewReservation: reservation_data 
    });
  }).catch(responder.errorFn());
});

server.post('/view-filter', function(req, res) {
  const lab = req.body.laboratory;
  const start = req.body.start_time;
  const end = req.body.end_time;
  

  // Construct the search query based on the received parameters
  const searchQuery = {};
  console.log(searchQuery);
  if (lab) {
      searchQuery.laboratory = lab;
  }
  if (start) {
      searchQuery.start_time = start;
  }
  if (end) {
    searchQuery.end_time = end;
  }

  // Find reservations based on the constructed query
  responder.reservationModel.find(searchQuery).lean().then(function(filteredData) {
      // Send back the filtered data as JSON response
      res.json(filteredData);
  }).catch(function(err) {
      // Handle errors appropriately
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
  });
});

server.post('/update-profile', upload.single('image'), async function(req, res) {
  const userID = req.body.id; // Assuming 'id' is the field name in your FormData for user ID
  const oldPassword = req.body.oldPassword; // Assuming 'password' is the field name for old password
  const newPassword = req.body.newPassword; // Assuming 'newPassword' is the field name for new password
  try {
    // Find the user by their ID
    const user = await responder.userModel.findOne({ user_id: userID });

    // Check if user exists
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    if (req.body.name){
      user.name = req.body.name;
      await user.save();
    } 
    if (req.body.desc){
      user.desc = req.body.desc;
      await user.save();
    } 
    if (req.file) {
      // Assuming you're storing images as buffers
      user.image = req.file.buffer;
      await user.save();
    }
    if (oldPassword && oldPassword !== user.password) {
      return res.status(403).json({ message: 'Old password incorrect. Update failed.' });
    }
    else{
      if (newPassword) user.password = newPassword;
      await user.save();
    }

    res.status(200).json({ message: 'Data updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});
    
server.get('/lab-selection', function(req, resp){
  let isStudent = 0, isLabTech = 0; 
  if (current_user.type === 'student')
    isStudent = 1;
  else if (current_user.type === 'lab-administrator')
    isLabTech = 1;
  resp.render('lab-selection',{
      layout: 'selection-index',
      title: 'Lab Selection',
      style: '/common/selection-style.css',
      current_user: current_user,
      isStudent: isStudent, 
      isLabTech: isLabTech
  });
});

const chem_rooms = '[{"room": "V101"}, {"room": "V102"},{"room": "V103"},{"room": "V104"},{"room": "V105"}]';
const comp_rooms = '[{"room": "G302"},{"room": "G303"},{"room": "G304"},{"room": "G305"}]';
const elec_rooms = '[{"room": "G403"}, {"room": "G404"}]';

let chem_list = JSON.parse(chem_rooms);
let comp_list = JSON.parse(comp_rooms);
let elec_list = JSON.parse(elec_rooms);

let isChem = 0, isComp = 0, isElec = 0; 
server.get('/slot-reservation/:lab', function(req, resp){
  //need student id
  //note that time should be in military format for easier checking
  //the reservations that you have to show have to be within range
  isChem = req.params.lab === 'Chemistry Laboratory';
  isComp = req.params.lab === 'Computer Laboratory';
  isElec = req.params.lab === 'Electronics Laboratory';
  let style = "";
  let room = "";
  if (isChem){
    style = '/common/slot-style-chem.css';
    room = chem_list; 
  }else if (isComp){
    style = "/common/slot-style-comp.css";
    room = comp_list; 
  }else{
    style = "/common/slot-style-elec.css";
    room = elec_list;
  } 
  
  resp.render('slot-reservation',{
    layout: 'slot-index',
    title: req.params.lab,
    style: style, 
    script: '/common/slot-script.js',
    lab: req.params.lab,
    isChem: isChem,
    isComp: isComp, 
    isElec: isElec,
    rooms: room
  });

});

server.post('/slot-ajax', function(req, resp){

  let date = String(req.body.date); 
  let room = String(req.body.room);
  let start_time_input = req.body.start_time; 
  let end_time_input = req.body.end_time; 

  console.log(date);

  console.log("Start time (node): " + start_time_input); 
  console.log("End time (node): " + end_time_input); 
  const searchQuery = {
    room: room,
    date: date,
    start_time: {$gte: start_time_input}, 
    end_time: {$lte: end_time_input}
  };

  responder.reservationModel.find(searchQuery).lean().then(function(reservations){
    if (reservations){
      console.log("Found"); 
      console.log(reservations);
      resp.send(reservations);
    }else{
      console.log("Not found"); 
      resp.status(404).send("Reservation not found");
    }
  });
});


const chem_eq = '[{"item": "Beaker (100 mL)"}, {"item": "Erlenmyer Flask"},{"item": "Bunsen Burner"}]';
const comp_eq = '[{"item": "LAN Cable"},{"item": "HDMI Cable"},{"item": "USB (128 GB)"}, {"item": "Keyboard"}]';
const elec_eq = '[{"item": "VOM"}, {"item": "Oscilloscope"}, {"item": "Wire Stripper"}]';

let chem_eq_list = JSON.parse(chem_eq);
let comp_eq_list = JSON.parse(comp_eq);
let elec_eq_list = JSON.parse(elec_eq);

server.post('/add-equipment', function(req, resp){
  
  let eq_list = "", lab = "";
  if (isChem){
    eq_list = chem_eq_list;
    lab = "Chemistry"
  }
  else if (isComp){
    eq_list = comp_eq_list;
    lab = "Computer"
  } 
  else{ 
    eq_list = elec_eq_list;
    lab = "Electrical"
  } 

  resp.render('add-equipment',{
      layout: 'index',
      title: 'Add Equipment',
      style: '/common/equipment-style.css',
      list: eq_list,
      lab: lab
  });
});

server.get('/receipt', function(req, resp){

  const searchQuery = {};
  responder.reservationModel.findOne({}).sort({_id: -1}).lean().then(function(last_reservation){
    if (last_reservation){
      console.log(last_reservation);
      resp.render('receipt',{
        layout: 'index',
        title: 'receipt',
        style: '/common/receipt-style.css', 
        last: last_reservation,
        current_user: current_user
      });
    }else{
      console.log("Not found"); 
      resp.status(404).send("Reservation not found");
    }
  });
  
});

server.get('/reservation-details', function(req, resp){
const searchQuery = {
        reservation_id: req.query.reservation_id,
        time_start: req.query.start_time
    };

    // Assuming you have a reservationModel schema/model
    responder.reservationModel.findOne(searchQuery).lean().then(function(details_data){
        if (details_data) {
            // If reservation details are found in the database, render the page with the retrieved data
            let isStudent = 0, isLabTech = 0; 
            if (current_user.type === 'student')
              isStudent = 1;
            else if (current_user.type === 'lab-administrator')
              isLabTech = 1;
            resp.render('reservation-details',{
                layout: 'index',
                title: 'Reservation Details',
                style: '/common/receipt-style.css',
                details: details_data,
                isStudent: isStudent,
                isLabTech: isLabTech, 
                current_user: current_user
                
            });
        } else {
            // If reservation details are not found, handle the error or display a message
            resp.status(404).send('Reservation not found');
        }
    }).catch(function(err){
        // Handle errors
        console.error(err);
        resp.status(500).send('Internal Server Error');
    });
});


process.on('SIGTERM',responder.finalClose);  //general termination signal
process.on('SIGINT', responder.finalClose);   //catches when ctrl + c is used
process.on('SIGQUIT', responder.finalClose); //catches other termination commands

const port = process.env.PORT | 3000;
server.listen(port, function(){
  console.log('Listening at port '+port);
});
