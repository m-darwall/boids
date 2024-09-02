// canvas variables
let flock_canvas = document.getElementById("flock-canvas");
let flock_canvas_height = document.documentElement.clientHeight;
let flock_canvas_width = document.documentElement.clientWidth;
let flock_ctx = flock_canvas.getContext("2d");
let continue_animating_birds = true;

// bird tracking variables
let birds = [];
let bird;
let delta_time = 0;
let previous_time;

// preset variables
const bird_colour = "#000000";
const max_birds = 1200;
const personal_space = 20;
const bird_length = 6;
const bird_width = 6;
const margin = -100;
const turn_intensity = 1;
const flock_depth = 3000;
const distance_to_camera = -flock_depth;
const scale = 1.5;
let field_of_view_horizontal = Math.PI/8;
let field_of_view_vertical = Math.PI/8;

// user adjustable variables
let birds_3d = true;
let number_of_birds = 600;
let view_distance = 80;
let max_speed = 10;
let coherence = 0.005;
let separation = 0.04;
let alignment = 0.05;

// adjusts canvas proportions
function render() {
    // set canvas proportions to match screen
    flock_canvas.width = document.documentElement.clientWidth;
    flock_canvas.height = document.documentElement.clientHeight;
    let width_change = flock_canvas.width/flock_canvas_width;
    let height_change = flock_canvas.height/flock_canvas_height;
    birds.forEach(
        // adjust bird positions on resize to keep all in frame
        function (node){
            node.x *= width_change;
            node.y *= height_change;
        });
    flock_canvas_width = flock_canvas.width;
    flock_canvas_height = flock_canvas.height;
    //adjust field of view for 3d view to suit proportions
    field_of_view_horizontal = 2*Math.atan(flock_canvas_width/(2*distance_to_camera));
    field_of_view_vertical = 2*Math.atan(flock_canvas_height/(2*distance_to_camera));
}

//adds a new bird to given location or defaults to a random position if unspecified
function add_bird(x = Math.random()*flock_canvas.width, y=Math.random()*flock_canvas.height, z= Math.random()*flock_depth){
    if(number_of_birds < max_birds) {
        number_of_birds++;
        birds.push(new Bird(x, y, z,(Math.random()-0.5)*2*max_speed, (Math.random()-0.5)*2*max_speed, (Math.random()-0.5)*2*max_speed));
        document.getElementById("bird-count").value = number_of_birds;
    }
}

// adjust number of birds when slider is adjusted
document.getElementById("bird-count").onchange = function (){
    let bird_count = parseInt(document.getElementById("bird-count").value);
    if(bird_count<=number_of_birds){
        number_of_birds = bird_count;
        birds = birds.slice(0, number_of_birds)
    }else{
        while(bird_count > number_of_birds){
            add_bird();
        }
    }
}

// adjust maximum bird speed when slider is adjusted
let bird_speed_slider = document.getElementById("bird-speed");
bird_speed_slider.onchange = function (){
    if(max_speed !== 0){
        let speed_change =  bird_speed_slider.value / max_speed;
        birds.forEach(function(a){a.dx*=speed_change;a.dy*=speed_change});
    } else{
        birds.forEach(function(a){a.dx=1;a.dy=1});
    }
    max_speed = parseInt(document.getElementById("bird-speed").value);
}

// update coherence when slider is adjusted
let bird_coherence_slider = document.getElementById("bird-coherence");
bird_coherence_slider.onchange = function(){coherence=bird_coherence_slider.value*(1.0/1000);};
// update separation when slider is adjusted
let bird_separation_slider = document.getElementById("bird-separation");
bird_separation_slider.onchange = function(){separation=bird_separation_slider.value*(1.0/1000);};
// update alignment when slider is adjusted
let bird_alignment_slider = document.getElementById("bird-alignment");
bird_alignment_slider.onchange = function(){alignment=bird_alignment_slider.value*(1.0/1000);};
// update view range when slider is adjusted
let bird_eyesight_slider = document.getElementById("bird-eyesight");
bird_eyesight_slider.onchange = function(){view_distance=bird_eyesight_slider.value;};
// update dimensions when checkbox checked/unchecked
let bird_3d_checkbox = document.getElementById("bird-3d");
bird_3d_checkbox.onchange = function(){
    // if switching to 2d, set all z values to 0
    if(birds_3d && !bird_3d_checkbox.checked){
        for(let bird_index = 0;bird_index<birds.length;bird_index++){
            birds[bird_index].z = 0;
            birds[bird_index].dz = 0
        }
        birds_3d = false;
    }
    // if switching to 3d, assign random z values
    if(!birds_3d && bird_3d_checkbox.checked){
        for(let bird_index = 0;bird_index<birds.length;bird_index++){
            birds[bird_index].z = (Math.random()-0.5)*flock_depth;
            birds[bird_index].dz = (Math.random()-0.5)*2*max_speed;
        }
        birds_3d = true;
    }
};


class Bird{
    constructor(x, y, z, dx, dy, dz) {
        this._x = x;
        this._y = y;
        this._z = z;
        this._dx = dx;
        this._dy = dy;
        this._dz = dz;
        // set z values to 0 if in 2d
        if(!birds_3d){
            this._dz = 0;
            this._z = 0;
        }
    }

    get z() {
        return this._z;
    }

    set z(value) {
        this._z = value;
    }

    get dz() {
        return this._dz;
    }

    set dz(value) {
        this._dz = value;
    }

    get dx() {
        return this._dx;
    }

    set dx(value) {
        this._dx = value;
    }

    get dy() {
        return this._dy;
    }

    set dy(value) {
        this._dy = value;
    }

    get x() {
        return this._x;
    }

    set x(value) {
        this._x = value;
    }

    get y() {
        return this._y;
    }

    set y(value) {
        this._y = value;
    }

    // adjust direction to align with nearby birds and head towards center of nearby birds
    align_and_cohere(){
        let x_align = 0;
        let y_align = 0;
        let z_align = 0;
        let x_cohere = 0;
        let y_cohere = 0;
        let z_cohere = 0;
        let bird_quantity = 0;
        for(let b=0;b<birds.length;b++){
            if(getDistance(this, birds[b])<=view_distance&&this!==birds[b]){
                bird_quantity++;
                x_align += birds[b].dx;
                y_align += birds[b].dy;
                z_align += birds[b].dz;
                x_cohere += birds[b].x;
                y_cohere += birds[b].y;
                z_cohere += birds[b].z;
            }
        }
        if(bird_quantity) {
            this._dx += alignment * ((x_align / bird_quantity)-this._dx);
            this._dy += alignment * ((y_align / bird_quantity)-this._dy);
            this._dz += alignment * ((z_align / bird_quantity)-this._dz);
            this._dx += coherence * (((x_cohere) / bird_quantity)-this.x);
            this._dy += coherence * (((y_cohere) / bird_quantity)-this.y);
            this._dz += coherence * (((z_cohere) / bird_quantity)-this.z);
        }
    }

    // adjust direction to avoid getting too close to other birds
    separate(){
        let goal_x = 0;
        let goal_y = 0;
        let goal_z = 0;
        let bird_quantity = 0;
        for(let b=0;b<birds.length;b++){
            if(getDistance(this, birds[b])<personal_space && birds[b]!==this){
                goal_x += this.x - birds[b].x;
                goal_y += this.y - birds[b].y;
                goal_z += this.z - birds[b].z;
                bird_quantity++;
            }
        }
        if(bird_quantity >0){
            this.dx += goal_x*separation;
            this.dy += goal_y*separation;
            this.dz += goal_z*separation;
        }
    }

    // adjust direction to steer away from edges
    avoidEdge() {
        if (this.x < margin) {
            this._dx += turn_intensity;
        } else if (this.x > flock_canvas.width - margin) {
            this._dx -= turn_intensity;
        }
        if (this.y < margin) {
            this._dy += turn_intensity;
        } else if (this.y > flock_canvas.height - margin) {
            this._dy -= turn_intensity;
        }
        if (this.z < margin) {
            this._dz += turn_intensity;
        } else if (this.z > flock_depth - margin) {
            this._dz -= turn_intensity;
        }
    }



}

// gets distance between two birds
function getDistance(bird1, bird2){
    return Math.sqrt((bird2.x-bird1.x)**2 + (bird2.y-bird1.y)**2 + (bird2.z-bird1.z)**2);
}


// draw current frame
function draw(current_time){
    // if no birds have been defined, add them
    if (birds.length===0){
        for(let i = 0;i<number_of_birds;i++){
            birds.push(new Bird(Math.random()*flock_canvas.width, Math.random()*flock_canvas.height, Math.random()*flock_depth, (Math.random()-0.5)*2*max_speed, (Math.random()-0.5)*2*max_speed, (Math.random()-0.5)*2*max_speed));
        }
    }
    // set bird colour
    flock_ctx.strokeStyle = bird_colour;
    flock_ctx.fillStyle = bird_colour;
    // clear canvas ready for new frame
    flock_ctx.clearRect(0, 0, flock_canvas.width, flock_canvas.height);
    // get time elapsed since last frame
    delta_time = current_time - previous_time;
    previous_time = current_time;

    //iterate through every bird
    for(let n = 0;n<number_of_birds;n++) {
        bird = birds[n];

        // adjust direction according to rules
        bird.align_and_cohere();
        bird.separate();
        bird.avoidEdge();

        // calculate speed
        let speed = (Math.sqrt(bird.dx**2 + bird.dy**2 + bird.dz**2));
        // slow down if exceeding maximum speed
        if(Math.abs(speed)  > max_speed){
            bird.dx *= Math.abs(max_speed/speed);
            bird.dy *= Math.abs(max_speed/speed);
            bird.dz *= Math.abs(max_speed/speed);
        }

        // update position according to velocity
        bird.x += bird.dx*delta_time*0.05;
        bird.y += bird.dy*delta_time*0.05;
        bird.z += bird.dz*delta_time*0.05;

        // projects a point in 3d space onto the 2d canvas
        function project(point){
            let depth = point[2]*scale + distance_to_camera;
            let new_x = point[0]/(1-depth/flock_canvas_width*Math.tan(field_of_view_horizontal/2));
            let new_y = point[1]/(1-depth/flock_canvas_height*Math.tan(field_of_view_vertical/2));
            return [new_x,new_y];
        }

        // rotates point a around the origin according to vector b
        function rotate(a, b){
            let v = [
                b[2],
                0,
                -b[0]
            ];
            let c =  b[1];

            let vCross = [
                [0, -v[2], v[1]],
                [v[2], 0, -v[0]],
                [-v[1], v[0], 0]
            ];

            let vCrossSq = [];
            for (let i = 0; i < 3; i++) {
                vCrossSq[i] = [];
                for (let j = 0; j < 3; j++) {
                    vCrossSq[i][j] = 0;
                    for (let k = 0; k < 3; k++) {
                        vCrossSq[i][j] += vCross[i][k] * vCross[k][j];
                    }
                }
            }

            let rotation = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ];

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    rotation[i][j] += vCross[i][j] + vCrossSq[i][j] * 1/(c + 1);
                }
            }

            let result = [0, 0, 0];
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    result[i] += rotation[i][j] * a[j];
                }
            }
            return result;
        }

        // points on the triangle when pointing in default direction
        let points = [
            [0,bird_length/2.0,0],
            [-bird_width*0.5, -bird_length/2.0,0],
            [bird_width*0.5, -bird_length/2.0,0]
        ];

        // iterate through points on triangle
        for(let point_index=0;point_index<points.length;point_index++){
            let point = points[point_index];
            //rotate the given point to align with bird velocity
            if(birds_3d){
                point = rotate(point, [bird.dx/speed, bird.dy/speed, bird.dz/speed]);
            }else{
                point = rotate(point, [bird.dx/speed, bird.dy/speed, 0]);
            }
            // add position coordinates to move bird to correct position
            point = [point[0]+bird.x, point[1]+bird.y, point[2]+bird.z];
            // if in 3d, project point from 3d to 2d
            if(birds_3d){
                point = project(point);
            }
            points[point_index] = point;
        }
        // draw the triangle
        flock_ctx.beginPath();
        flock_ctx.moveTo(points[0][0], points[0][1]);
        flock_ctx.lineTo(points[1][0], points[1][1]);
        flock_ctx.lineTo(points[2][0], points[2][1]);
        flock_ctx.closePath();
        flock_ctx.fill();
        flock_ctx.stroke();

    }
    // continue animating unless told otherwise
    if(continue_animating_birds){
        window.requestAnimationFrame(draw);
    }
}

// adds a bird at mouse position on click
function add_bird_at_mouse(evt){
    let mousePos = getMousePos(flock_canvas, evt);
    add_bird(mousePos.x, mousePos.y, Math.random()*flock_depth);
}

// stops animating birds
function stop_birds(){
    continue_animating_birds = false;
    document.getElementById("flock-options-container").style.visibility = "hidden";
    window.cancelAnimationFrame(draw);
}

// starts animating birds
function start_birds(){
    continue_animating_birds = true;
    window.addEventListener("mousedown", add_bird_at_mouse, false);
    document.getElementById("flock-options-container").style.visibility = "visible";
    window.addEventListener("resize", function(){render();}, true);
    render();
    previous_time = performance.now();
    window.requestAnimationFrame(draw);
}

