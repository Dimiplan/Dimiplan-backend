use std::process::Command;
use rocket::http::Status;
#[macro_use] extern crate rocket;

#[get("/")]
fn index() -> (Status, String) {
    let output = Command::new("git")
        .arg("pull")
        .output()
        .expect("Failed to execute command");

    if output.status.success() && !String::from_utf8_lossy(&output.stdout).contains("Already up to date.") {
        (Status::Ok, format!("Changes applied: {}", String::from_utf8_lossy(&output.stdout).trim()))
    } else if String::from_utf8_lossy(&output.stdout).contains("Already up to date.") {
        (Status::NoContent, String::from("No changes to apply"))
    } else {
        (Status::InternalServerError, format!("Error applying changes: {}", String::from_utf8_lossy(&output.stderr).trim()))
    }
}

#[launch]
fn rocket() -> _ {
    rocket::build().mount("/", routes![index])
}