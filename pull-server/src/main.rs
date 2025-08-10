use std::process::Command;
#[macro_use] extern crate rocket;

#[get("/")]
fn index() -> String {
    let output = Command::new("git")
        .arg("pull")
        .output()
        .expect("Failed to execute command");

    if output.status.success() && output.stdout != b"Already up to date." {
        println!("{}", String::from_utf8_lossy(&output.stdout));
        String::from("Changes applied")
    } else if output.stdout == b"Already up to date." {
        String::from("No changes to apply")
    } else {
        String::from("Error applying changes")
    }
}

#[launch]
fn rocket() -> _ {
    rocket::build().mount("/", routes![index])
}