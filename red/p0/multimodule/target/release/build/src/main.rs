#[allow(unused_imports)]
use std::fmt::Write as _;
use logicaffeine_data::*;
use logicaffeine_system::*;

pub mod user_types {
    use super::*;

    #[derive(Default, Debug, Clone, PartialEq)]
    pub struct Colors__Color {
        pub r: i64,
        pub g: i64,
        pub b: i64,
    }

    #[derive(Default, Debug, Clone, PartialEq)]
    pub struct Geometry__Point {
        pub x: i64,
        pub y: i64,
    }

}

use user_types::*;

fn main() {
    std::thread::Builder::new()
        .stack_size(67_108_864)
        .spawn(_logos_main)
        .unwrap().join().unwrap();
}
fn _logos_main() {
    let p = Geometry__Point { x: 3, y: 4, ..Default::default() };
    let c = Colors__Color { r: 250, g: 5, b: 1, ..Default::default() };
    show(&((((p.x + p.y) + c.r) + c.g) + c.b));
}
