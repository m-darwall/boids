const bird_colour = "#000000";
const max_birds = 1200;
const personal_space = 20;
const bird_length = 6;
const bird_width = 5;
const margin = -100;
const turn_intensity = 1;
const flock_depth = 3000;
const distance_to_camera = -flock_depth;
const scale = 1.5;


// object used to keep track of animation canvas
class Canvas{
    #field_of_view_horizontal;
    #field_of_view_vertical;
    #dimension_3 = true;
    #height;
    #width;
    #context;
    constructor(id){
        this.canvas = document.getElementById(id);
        this.#context = this.canvas.getContext("2d");
        this.#height = this.canvas.height;
        this.#width = this.canvas.width;
        this.#field_of_view_horizontal = 2*Math.atan(this.width/(2*distance_to_camera));
        this.#field_of_view_vertical = 2*Math.atan(this.height/(2*distance_to_camera));
    }


    set width(value) {
        this.#width = value;
    }

    set height(value) {
        this.#height = value;
    }

    get width() {
        return this.#width;
    }

    get height() {
        return this.#height;
    }

    set field_of_view_horizontal(value) {
        this.#field_of_view_horizontal = value;
    }

    set field_of_view_vertical(value) {
        this.#field_of_view_vertical = value;
    }

    get field_of_view_horizontal() {
        return this.#field_of_view_horizontal;
    }

    get field_of_view_vertical() {
        return this.#field_of_view_vertical;
    }

    get context() {
        return this.#context;
    }

    get dimension_3() {
        return this.#dimension_3;
    }

    set dimension_3(value) {
        this.#dimension_3 = value;
    }
}

// class used to keep track of all boids
class Flock{
    #birds = [];
    #delta_time = 0;
    #previous_time;
    #number_of_birds = 600;
    #view_range = 80;
    #max_speed = 10;
    #coherence = 0.005;
    #separation = 0.04;
    #alignment = 0.05;
    #animation_toggle = true;

    constructor(canvas_id) {
        this.canvas = new Canvas(canvas_id);
        window.addEventListener("resize", this.render.bind(this), true);
    }

    // adjusts canvas proportions
    render() {
        // set canvas proportions to match screen
        this.canvas.canvas.width = document.documentElement.clientWidth;
        this.canvas.canvas.height = document.documentElement.clientHeight;
        let width_change = this.canvas.width /this.canvas.canvas.width;
        let height_change = this.canvas.height/this.canvas.canvas.height;
        this.#birds.forEach(
            // adjust bird positions on resize to keep all in frame
            function (node){
                node.x *= width_change;
                node.y *= height_change;
            });
        this.canvas.width = this.canvas.canvas.width;
        this.canvas.height = this.canvas.canvas.height;
        //adjust field of view for 3d view to suit proportions
        this.canvas.field_of_view_horizontal = 2*Math.atan(this.canvas.width/(2*distance_to_camera));
        this.canvas.field_of_view_vertical = 2*Math.atan(this.canvas.height/(2*distance_to_camera));
    }

    // stops animating birds
    stop_birds(){
        this.#animation_toggle = false;
        window.cancelAnimationFrame(this.draw);
    }

    // starts animating birds
    start_birds(){
        this.#animation_toggle = true;
        this.render();
        this.#previous_time = performance.now();
        window.requestAnimationFrame(this.draw.bind(this));
    }


    //adds a new bird to given location or defaults to a random position if unspecified
    add_bird(x = Math.random()*this.canvas.width, y=Math.random()*this.canvas.height, z= Math.random()*flock_depth){
        if(this.#number_of_birds < max_birds) {
            this.#number_of_birds++;
            this.#birds.push(new Bird(this, x, y, z,
                (Math.random()-0.5)*2*Math.sqrt(this.#max_speed),
                (Math.random()-0.5)*2*Math.sqrt(this.#max_speed),
                (Math.random()-0.5)*2*Math.sqrt(this.#max_speed)));
        }
    }

    // gets distance between two birds
    getDistance(bird1, bird2){
        return Math.sqrt((bird2.x-bird1.x)**2 + (bird2.y-bird1.y)**2 + (bird2.z-bird1.z)**2);
    }

    // draw current frame
    draw(current_time){
        let ctx = this.canvas.context;
        // if no birds have been defined, add them
        if (this.#birds.length===0){
            let number = this.#number_of_birds;
            this.#number_of_birds = 0;
            this.set_bird_number(number);
        }
        // set bird colour
        ctx.strokeStyle = bird_colour;
        ctx.fillStyle = bird_colour;
        // clear canvas ready for new frame
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // get time elapsed since last frame
        this.#delta_time = current_time - this.#previous_time;
        this.#previous_time = current_time;


        //iterate through every bird
        for(let n = 0;n<this.#number_of_birds;n++) {
            let bird = this.#birds[n];
            // adjust direction according to rules

            bird.align_and_cohere();
            bird.separate();
            bird.avoidEdge();

            // calculate speed
            let speed = (Math.sqrt(bird.dx ** 2 + bird.dy ** 2 + bird.dz ** 2));
            if(this.#max_speed > 0) {
                // slow down if exceeding maximum speed
                if (Math.abs(speed) > this.#max_speed) {
                    bird.dx *= Math.abs(this.#max_speed / speed);
                    bird.dy *= Math.abs(this.#max_speed / speed);
                    bird.dz *= Math.abs(this.#max_speed / speed);
                }

                // update position according to velocity
                bird.x += bird.dx * this.#delta_time * 0.05;
                bird.y += bird.dy * this.#delta_time * 0.05;
                bird.z += bird.dz * this.#delta_time * 0.05;
            }

            // projects a point in 3d space onto the 2d canvas
            function project(point, width, height, fov_x, fov_y){
                let depth = point[2]*scale + distance_to_camera;
                let new_x = point[0]/(1-depth/width*Math.tan(fov_x/2));
                let new_y = point[1]/(1-depth/height*Math.tan(fov_y/2));
                return [new_x,new_y];
            }

            // rotates point A around the origin according to vector B
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
                if(this.canvas.dimension_3){
                    point = rotate(point, [bird.dx/speed, bird.dy/speed, bird.dz/speed]);
                }else{
                    point = rotate(point, [bird.dx/speed, bird.dy/speed, 0]);
                }
                // add position coordinates to move bird to correct position
                point = [point[0]+bird.x, point[1]+bird.y, point[2]+bird.z];
                // if in 3d, project point from 3d to 2d
                if(this.canvas.dimension_3){
                    point = project(point, this.canvas.width, this.canvas.height, this.canvas.field_of_view_horizontal, this.canvas.field_of_view_vertical);
                }
                points[point_index] = point;
            }
            // draw the triangle
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            ctx.lineTo(points[1][0], points[1][1]);
            ctx.lineTo(points[2][0], points[2][1]);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

        }
        // continue animating unless told otherwise
        if(this.#animation_toggle){
            window.requestAnimationFrame(this.draw.bind(this));
        }
    }

    get birds() {
        return this.#birds;
    }

    get coherence() {
        return this.#coherence;
    }

    get separation() {
        return this.#separation;
    }

    get alignment() {
        return this.#alignment;
    }

    get view_range() {
        return this.#view_range;
    }

    set coherence(value) {
        this.#coherence = value;
    }

    set separation(value) {
        this.#separation = value;
    }

    set alignment(value) {
        this.#alignment = value;
    }

    set view_range(value){
        this.#view_range = value;
    }

    go_3d(){
        if(this.canvas.dimension_3){
            return true;
        }
        for(let bird_index = 0;bird_index<this.#birds.length;bird_index++){
            this.#birds[bird_index].z = (Math.random()-0.5)*flock_depth;
            this.#birds[bird_index].dz = (Math.random()-0.5)*2*this.#max_speed;
        }
        this.canvas.dimension_3 = true;
        return true;
    }

    go_2d(){
        if(!this.canvas.dimension_3){
            return true;
        }
        for(let bird_index = 0;bird_index<this.#birds.length;bird_index++){
            this.#birds[bird_index].z = 0;
            this.#birds[bird_index].dz = 0;
        }
        this.canvas.dimension_3 = false;
        return true;
    }




    set_bird_number(number){
        if (number < max_birds){
            if (number < this.#number_of_birds){
                this.#birds = this.#birds.slice(0, number);
                this.#number_of_birds = number;
            } else {
                while (this.#birds.length < number){
                    this.add_bird();
                }
            }
            return true;
        }
        return false;
    }

    set_max_speed(number){
        if (number < 1){
            number = 1;
        }
        let speed_change =  number / this.#max_speed;
        this.#birds.forEach(function(a){a.dx*=speed_change;a.dy*=speed_change;a.dz*=speed_change});
        this.#max_speed = number;
    }
}




class Bird{
    #flock;
    constructor(flock, x, y, z, dx, dy, dz) {
        this.#flock = flock;
        this._x = x;
        this._y = y;
        this._z = z;
        this._dx = dx;
        this._dy = dy;
        this._dz = dz;
        // set z values to 0 if in 2d
        if(!this.#flock.canvas.dimension_3){
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
        let birds = this.#flock.birds;
        for(let b=0;b<birds.length;b++){
            if(this.#flock.getDistance(this, birds[b])<=this.#flock.view_range&&this!==birds[b]){
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
            this._dx += this.#flock.alignment * ((x_align / bird_quantity)-this._dx);
            this._dy += this.#flock.alignment * ((y_align / bird_quantity)-this._dy);
            this._dz += this.#flock.alignment * ((z_align / bird_quantity)-this._dz);
            this._dx += this.#flock.coherence * (((x_cohere) / bird_quantity)-this.x);
            this._dy += this.#flock.coherence * (((y_cohere) / bird_quantity)-this.y);
            this._dz += this.#flock.coherence * (((z_cohere) / bird_quantity)-this.z);
        }
    }

    // adjust direction to avoid getting too close to other birds
    separate(){
        let goal_x = 0;
        let goal_y = 0;
        let goal_z = 0;
        let bird_quantity = 0;
        let birds = this.#flock.birds;
        for(let b=0;b<birds.length;b++){
            if(this.#flock.getDistance(this, birds[b])<personal_space && birds[b]!==this){
                goal_x += this.x - birds[b].x;
                goal_y += this.y - birds[b].y;
                goal_z += this.z - birds[b].z;
                bird_quantity++;
            }
        }
        if(bird_quantity >0){
            this.dx += goal_x*this.#flock.separation;
            this.dy += goal_y*this.#flock.separation;
            this.dz += goal_z*this.#flock.separation;
        }
    }

    // adjust direction to steer away from edges
    avoidEdge() {
        if (this.x < margin) {
            this._dx += turn_intensity;
        } else if (this.x > this.#flock.canvas.width - margin) {
            this._dx -= turn_intensity;
        }
        if (this.y < margin) {
            this._dy += turn_intensity;
        } else if (this.y > this.#flock.canvas.height - margin) {
            this._dy -= turn_intensity;
        }
        if (this.z < margin) {
            this._dz += turn_intensity;
        } else if (this.z > flock_depth - margin) {
            this._dz -= turn_intensity;
        }
    }

}






